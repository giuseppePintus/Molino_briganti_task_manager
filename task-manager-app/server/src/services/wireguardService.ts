// Servizio gestione peer WireGuard
//
// Architettura:
// - I file dei peer vivono in /share/Container/wireguard/config (montato in /wireguard nel container)
// - Generiamo chiavi curve25519 con tweetnacl (puro JS, no binari esterni)
// - Aggiungiamo/rimuoviamo sezioni in wg_confs/wg0.conf
// - Touchiamo .reload-trigger: un sidecar nel container wireguard fa wg syncconf

import * as fs from 'fs';
import * as path from 'path';
import * as nacl from 'tweetnacl';
import * as crypto from 'crypto';
import QRCode from 'qrcode';

// Path radice della config WireGuard. Override con env WG_CONFIG_DIR per dev.
const WG_CONFIG_DIR = process.env.WG_CONFIG_DIR || '/wireguard';
const WG_CONF_FILE = path.join(WG_CONFIG_DIR, 'wg_confs', 'wg0.conf');
const WG_RELOAD_TRIGGER = path.join(WG_CONFIG_DIR, '.reload-trigger');

// Subnet VPN: 10.6.0.0/24, .1 = server, .2..254 = peer
const SUBNET_PREFIX = '10.6.0.';
const SERVER_HOST = 1;
const FIRST_PEER_HOST = 2;
const LAST_PEER_HOST = 254;

// Endpoint pubblico (lo legge dalla wg0.conf esistente)
let cachedServerInfo: { publicKey: string; endpoint: string; port: number } | null = null;

export interface WgPeerSummary {
    name: string;
    address: string;          // 10.6.0.X
    publicKey: string;
    createdAt: string | null; // ISO o null
    hasConf: boolean;
    hasQr: boolean;
}

export interface WgPeerDetail extends WgPeerSummary {
    conf: string;             // contenuto del peer_<name>.conf
    qrPng: string;            // data:image/png;base64,...
}

// ---------- Util chiavi curve25519 (formato WireGuard = base64) ----------

function genKeypair(): { privateKey: string; publicKey: string } {
    // WireGuard usa curve25519 raw. Genera 32 byte random, applica clamping.
    const priv = crypto.randomBytes(32);
    priv[0] &= 248;
    priv[31] &= 127;
    priv[31] |= 64;
    const kp = nacl.box.keyPair.fromSecretKey(new Uint8Array(priv));
    return {
        privateKey: Buffer.from(kp.secretKey).toString('base64'),
        publicKey: Buffer.from(kp.publicKey).toString('base64'),
    };
}

function genPresharedKey(): string {
    return crypto.randomBytes(32).toString('base64');
}

// ---------- Validazione nome peer ----------

const NAME_RE = /^[a-z0-9]{2,24}$/;

export function isValidPeerName(name: string): boolean {
    return NAME_RE.test(name);
}

// ---------- Lettura wg0.conf per ricavare server info ----------

function readServerInfo(): { publicKey: string; endpoint: string; port: number } {
    if (cachedServerInfo) return cachedServerInfo;
    if (!fs.existsSync(WG_CONF_FILE)) {
        throw new Error(`wg0.conf non trovato in ${WG_CONF_FILE}`);
    }
    const content = fs.readFileSync(WG_CONF_FILE, 'utf-8');
    // Estrae PrivateKey dell'interfaccia per derivare la public key
    const ifaceMatch = content.match(/\[Interface\]([\s\S]*?)(?=\n\[|$)/);
    if (!ifaceMatch) throw new Error('Sezione [Interface] mancante in wg0.conf');
    const iface = ifaceMatch[1];
    const privMatch = iface.match(/PrivateKey\s*=\s*(\S+)/);
    if (!privMatch) throw new Error('PrivateKey mancante in [Interface]');
    const portMatch = iface.match(/ListenPort\s*=\s*(\d+)/);
    const port = portMatch ? parseInt(portMatch[1], 10) : 51820;

    // Deriva public key dalla private
    const privBuf = Buffer.from(privMatch[1], 'base64');
    const kp = nacl.box.keyPair.fromSecretKey(new Uint8Array(privBuf));
    const publicKey = Buffer.from(kp.publicKey).toString('base64');

    // Endpoint pubblico: prendiamo da env (settato in compose) o fallback IP NAS
    const endpoint = process.env.WG_PUBLIC_ENDPOINT || '185.94.80.35';

    cachedServerInfo = { publicKey, endpoint, port };
    return cachedServerInfo;
}

// ---------- Listing peer ----------

export function listPeers(): WgPeerSummary[] {
    if (!fs.existsSync(WG_CONFIG_DIR)) return [];
    const entries = fs.readdirSync(WG_CONFIG_DIR, { withFileTypes: true });
    const peers: WgPeerSummary[] = [];
    for (const e of entries) {
        if (!e.isDirectory() || !e.name.startsWith('peer_')) continue;
        const name = e.name.substring(5);
        if (!isValidPeerName(name)) continue;
        const dir = path.join(WG_CONFIG_DIR, e.name);
        const confFile = path.join(dir, `peer_${name}.conf`);
        const qrFile = path.join(dir, `peer_${name}.png`);
        const pubFile = path.join(dir, 'publickey');
        let publicKey = '';
        if (fs.existsSync(pubFile)) publicKey = fs.readFileSync(pubFile, 'utf-8').trim();
        let address = '';
        if (fs.existsSync(confFile)) {
            const m = fs.readFileSync(confFile, 'utf-8').match(/Address\s*=\s*([\d.]+)/);
            if (m) address = m[1];
        }
        let createdAt: string | null = null;
        try {
            createdAt = fs.statSync(dir).birthtime.toISOString();
        } catch { /* ignore */ }
        peers.push({
            name,
            address,
            publicKey,
            createdAt,
            hasConf: fs.existsSync(confFile),
            hasQr: fs.existsSync(qrFile),
        });
    }
    return peers.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Allocazione IP libero ----------

function nextFreeAddress(): string {
    const used = new Set<number>([SERVER_HOST]);
    for (const p of listPeers()) {
        const m = p.address.match(/^10\.6\.0\.(\d+)$/);
        if (m) used.add(parseInt(m[1], 10));
    }
    for (let h = FIRST_PEER_HOST; h <= LAST_PEER_HOST; h++) {
        if (!used.has(h)) return `${SUBNET_PREFIX}${h}`;
    }
    throw new Error('Nessun IP libero nella subnet 10.6.0.0/24');
}

// ---------- Add peer ----------

export interface AddPeerResult extends WgPeerDetail {}

export async function addPeer(name: string): Promise<AddPeerResult> {
    if (!isValidPeerName(name)) {
        throw new Error('Nome peer non valido (solo a-z0-9, 2-24 caratteri)');
    }
    const peerDir = path.join(WG_CONFIG_DIR, `peer_${name}`);
    if (fs.existsSync(peerDir)) {
        throw new Error(`Peer "${name}" gia' esistente`);
    }
    const server = readServerInfo();
    const address = nextFreeAddress();
    const { privateKey, publicKey } = genKeypair();
    const presharedKey = genPresharedKey();

    // Conf client
    const clientConf =
        `[Interface]\n` +
        `Address = ${address}\n` +
        `PrivateKey = ${privateKey}\n` +
        `ListenPort = 51820\n` +
        `DNS = 1.1.1.1\n\n` +
        `[Peer]\n` +
        `PublicKey = ${server.publicKey}\n` +
        `PresharedKey = ${presharedKey}\n` +
        `Endpoint = ${server.endpoint}:${server.port}\n` +
        `AllowedIPs = 192.168.1.248/32\n`;

    fs.mkdirSync(peerDir, { recursive: true });
    fs.writeFileSync(path.join(peerDir, `peer_${name}.conf`), clientConf, { mode: 0o600 });
    fs.writeFileSync(path.join(peerDir, 'privatekey'), privateKey + '\n', { mode: 0o600 });
    fs.writeFileSync(path.join(peerDir, 'publickey'), publicKey + '\n', { mode: 0o600 });
    fs.writeFileSync(path.join(peerDir, 'presharedkey'), presharedKey + '\n', { mode: 0o600 });

    // QR
    const qrDataUrl = await QRCode.toDataURL(clientConf, { width: 512, margin: 2 });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(peerDir, `peer_${name}.png`), qrBuffer, { mode: 0o600 });

    // Append a wg0.conf (idempotente: rimuove eventuale sezione precedente con stesso commento)
    // Mettiamo il commento DENTRO il blocco [Peer], dopo l'header: cosi' il parser
    // non lo confonde con il blocco precedente.
    const peerSection =
        `\n[Peer]\n` +
        `# peer_${name}\n` +
        `PublicKey = ${publicKey}\n` +
        `PresharedKey = ${presharedKey}\n` +
        `AllowedIPs = ${address}/32\n`;
    const current = fs.readFileSync(WG_CONF_FILE, 'utf-8');
    const cleaned = removePeerSection(current, name, publicKey);
    fs.writeFileSync(WG_CONF_FILE, cleaned + peerSection, { mode: 0o600 });

    // Trigger reload (sidecar inotifywait nel container wireguard)
    triggerReload();

    return {
        name,
        address,
        publicKey,
        createdAt: new Date().toISOString(),
        hasConf: true,
        hasQr: true,
        conf: clientConf,
        qrPng: qrDataUrl,
    };
}

// ---------- Remove peer ----------

export function removePeer(name: string): void {
    if (!isValidPeerName(name)) throw new Error('Nome peer non valido');
    const peerDir = path.join(WG_CONFIG_DIR, `peer_${name}`);
    if (!fs.existsSync(peerDir)) throw new Error(`Peer "${name}" non trovato`);

    // Leggi public key del peer PRIMA di rimuovere la dir, per matching robusto
    // (supporta sia formato nostro 'publickey' sia formato linuxserver 'publickey-peer_<name>')
    let publicKey: string | null = null;
    const candidates = [
        path.join(peerDir, 'publickey'),
        path.join(peerDir, `publickey-peer_${name}`),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            publicKey = fs.readFileSync(c, 'utf-8').trim();
            break;
        }
    }

    // Rimuove sezione da wg0.conf (match per nome E/O public key)
    const current = fs.readFileSync(WG_CONF_FILE, 'utf-8');
    fs.writeFileSync(WG_CONF_FILE, removePeerSection(current, name, publicKey), { mode: 0o600 });

    // Cancella cartella peer
    fs.rmSync(peerDir, { recursive: true, force: true });

    triggerReload();
}

// ---------- Get peer detail (per scaricare QR/conf) ----------

export function getPeerDetail(name: string): WgPeerDetail {
    if (!isValidPeerName(name)) throw new Error('Nome peer non valido');
    const peerDir = path.join(WG_CONFIG_DIR, `peer_${name}`);
    if (!fs.existsSync(peerDir)) throw new Error(`Peer "${name}" non trovato`);
    const confPath = path.join(peerDir, `peer_${name}.conf`);
    const qrPath = path.join(peerDir, `peer_${name}.png`);
    const conf = fs.readFileSync(confPath, 'utf-8');
    const qrBase64 = fs.readFileSync(qrPath).toString('base64');
    const summary = listPeers().find(p => p.name === name);
    if (!summary) throw new Error('Peer summary mancante');
    return {
        ...summary,
        conf,
        qrPng: `data:image/png;base64,${qrBase64}`,
    };
}

export function getPeerQrBuffer(name: string): Buffer {
    if (!isValidPeerName(name)) throw new Error('Nome peer non valido');
    const qrPath = path.join(WG_CONFIG_DIR, `peer_${name}`, `peer_${name}.png`);
    if (!fs.existsSync(qrPath)) throw new Error('QR non trovato');
    return fs.readFileSync(qrPath);
}

export function getPeerConfText(name: string): string {
    if (!isValidPeerName(name)) throw new Error('Nome peer non valido');
    const confPath = path.join(WG_CONFIG_DIR, `peer_${name}`, `peer_${name}.conf`);
    if (!fs.existsSync(confPath)) throw new Error('Conf non trovato');
    return fs.readFileSync(confPath, 'utf-8');
}

// ---------- Helpers interni ----------

function removePeerSection(content: string, name: string, publicKey: string | null = null): string {
    // Parser a blocchi robusto. Identifica un blocco [Peer] come "da rimuovere" se:
    //   (1) la sua PublicKey corrisponde a quella passata (match piu' affidabile), OPPURE
    //   (2) contiene un commento "# peer_<name>" nell'HEADER (righe tra [Peer] e
    //       la prima riga di dati come PublicKey/AllowedIPs/PresharedKey/Endpoint), OPPURE
    //   (3) nelle righe IMMEDIATAMENTE precedenti il blocco [Peer] (trailing del blocco
    //       precedente: solo righe vuote/commento) c'e' un commento "# peer_<name>".
    //
    // Importante: NON cerchiamo il marker ovunque dentro il blocco, perche' nel
    // formato che produciamo noi il commento del peer SUCCESSIVO finisce in coda
    // al blocco precedente (le righe tra l'ultimo dato e il prossimo [Peer]).

    const lines = content.split('\n');
    const markerRe = new RegExp(`^\\s*#\\s*peer_${name}\\b`);
    const dataLineRe = /^\s*(PublicKey|PresharedKey|AllowedIPs|Endpoint|PersistentKeepalive)\s*=/i;
    const pubKeyRe = publicKey
        ? new RegExp(`^\\s*PublicKey\\s*=\\s*${publicKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`)
        : null;

    type Block = { lines: string[]; isPeer: boolean };
    const blocks: Block[] = [];
    let cur: Block | null = null;
    const preamble: string[] = [];

    for (const line of lines) {
        const sectMatch = /^\s*\[(Interface|Peer)\]\s*$/.exec(line);
        if (sectMatch) {
            if (cur) blocks.push(cur);
            cur = { lines: [line], isPeer: sectMatch[1] === 'Peer' };
        } else if (cur) {
            cur.lines.push(line);
        } else {
            preamble.push(line);
        }
    }
    if (cur) blocks.push(cur);

    // Helper: trova indice della prima "data line" in un blocco (skip [Peer] iniziale)
    const firstDataIdx = (blk: Block): number => {
        for (let i = 1; i < blk.lines.length; i++) {
            if (dataLineRe.test(blk.lines[i])) return i;
        }
        return blk.lines.length;
    };

    const toRemove = new Set<number>();
    const removedTrailing = new Map<number, Set<number>>(); // blockIdx -> set di line idx da droppare

    for (let b = 0; b < blocks.length; b++) {
        const blk = blocks[b];
        if (!blk.isPeer) continue;

        // (1) Match per public key
        if (pubKeyRe && blk.lines.some(l => pubKeyRe.test(l))) {
            toRemove.add(b);
            continue;
        }

        // (2) Marker nell'header (righe 1..firstDataIdx-1)
        const dataIdx = firstDataIdx(blk);
        let foundInHeader = false;
        for (let i = 1; i < dataIdx; i++) {
            if (markerRe.test(blk.lines[i])) { foundInHeader = true; break; }
        }
        if (foundInHeader) {
            toRemove.add(b);
            continue;
        }

        // (3) Marker nel trailing del blocco precedente (o preambolo se b==0)
        const aboveLines = b === 0 ? preamble : blocks[b - 1].lines;
        // Scansiona dal fondo: solo righe vuote o commento; fermati al primo dato/sezione
        const droppedIdx = new Set<number>();
        let matched = false;
        for (let i = aboveLines.length - 1; i >= 0; i--) {
            const l = aboveLines[i].trim();
            if (l === '') continue;
            if (l.startsWith('#')) {
                if (markerRe.test(l)) {
                    matched = true;
                    droppedIdx.add(i);
                    break;
                }
                // commento di un altro peer: non e' nostro, fermati
                break;
            }
            // riga di dati o sezione: stop
            break;
        }
        if (matched) {
            toRemove.add(b);
            const key = b === 0 ? -1 : b - 1;
            const existing = removedTrailing.get(key) ?? new Set<number>();
            for (const i of droppedIdx) existing.add(i);
            removedTrailing.set(key, existing);
        }
    }

    if (toRemove.size === 0) return content;

    // Ricostruisci
    const out: string[] = [];
    const preambleDrop = removedTrailing.get(-1) ?? new Set<number>();
    for (let i = 0; i < preamble.length; i++) {
        if (!preambleDrop.has(i)) out.push(preamble[i]);
    }
    for (let b = 0; b < blocks.length; b++) {
        if (toRemove.has(b)) continue;
        const drop = removedTrailing.get(b) ?? new Set<number>();
        for (let i = 0; i < blocks[b].lines.length; i++) {
            if (!drop.has(i)) out.push(blocks[b].lines[i]);
        }
    }
    // Compatta righe vuote multiple
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function triggerReload(): void {
    try {
        fs.writeFileSync(WG_RELOAD_TRIGGER, new Date().toISOString());
    } catch (err) {
        // Non fatale: la modifica al file e' gia' avvenuta, peggio caso restart manuale
        console.error('[wireguard] trigger reload fallito:', err);
    }
}

// ---------- Status (handshake info, opzionale futuro) ----------
// Non implementato: richiederebbe accesso al binario wg che non e' nel container task-manager.
// Si potrebbe esporre tramite endpoint nel sidecar reloader, ma per ora teniamo l'UI minimale.
