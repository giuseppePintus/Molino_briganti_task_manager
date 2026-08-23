import * as net from 'net';
import prisma from '../lib/prisma';

// ─── TCP RAW ─────────────────────────────────────────────────────

function sendRaw(ip: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(3000);
    client.connect(port, ip, () => {
      client.write(data, () => {
        // breve attesa per permettere al buffer di svuotarsi prima di chiudere
        setTimeout(() => { client.destroy(); resolve(); }, 300);
      });
    });
    client.on('error', (err) => { client.destroy(); reject(err); });
    client.on('timeout', () => {
      client.destroy();
      reject(new Error(`Timeout connessione a ${ip}:${port}`));
    });
  });
}

// ─── ESC/POS helpers ─────────────────────────────────────────────

const ESC = 0x1B;
const GS  = 0x1D;

const INIT     = Buffer.from([ESC, 0x40]);
const ALIGN_C  = Buffer.from([ESC, 0x61, 0x01]);
const ALIGN_L  = Buffer.from([ESC, 0x61, 0x00]);
const ALIGN_R  = Buffer.from([ESC, 0x61, 0x02]);
const BOLD_ON  = Buffer.from([ESC, 0x45, 0x01]);
const BOLD_OFF = Buffer.from([ESC, 0x45, 0x00]);
const DBLH_ON  = Buffer.from([ESC, 0x21, 0x10]);
const DBLH_OFF = Buffer.from([ESC, 0x21, 0x00]);
const CUT      = Buffer.from([GS,  0x56, 0x42, 0x00]);

const LW = 48; // caratteri per riga a 80mm

function esc(text: string): Buffer {
  return Buffer.from(text + '\n', 'utf8');
}
function hr(ch = '-'): Buffer {
  return esc(ch.repeat(LW));
}
function padLR(left: string, right: string): string {
  const sp = Math.max(0, LW - left.length - right.length);
  return left + ' '.repeat(sp) + right;
}
function ctr(text: string): string {
  const sp = Math.max(0, Math.floor((LW - text.length) / 2));
  return ' '.repeat(sp) + text;
}

// Evita caratteri non ASCII che ESC/POS non sa gestire
function sanitize(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // rimuove diacritici
    .replace(/[^\x20-\x7E]/g, '?');
}

// ─── ESC/POS: test ───────────────────────────────────────────────

function buildEscPosTest(printerName: string): Buffer {
  return Buffer.concat([
    INIT, ALIGN_C,
    BOLD_ON, DBLH_ON, esc('MOLINO BRIGANTI'), DBLH_OFF, BOLD_OFF,
    hr('='),
    esc(ctr('--- TEST STAMPA ---')),
    esc(ctr(sanitize(printerName))),
    esc(ctr(new Date().toLocaleString('it-IT'))),
    hr('='),
    Buffer.from('\n\n\n'),
    CUT,
  ]);
}

// ─── ESC/POS: viaggio ────────────────────────────────────────────

async function buildEscPosTripReceipt(tripId: number): Promise<Buffer> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { assignedOperator: true },
  });
  if (!trip) throw new Error(`Viaggio #${tripId} non trovato`);

  const orders = await prisma.order.findMany({
    where: { tripId },
    include: {
      customer: true,
      items: { include: { article: { select: { code: true, name: true } } } },
    },
    orderBy: { id: 'asc' },
  });

  // Rispetta la sequenza definita nel viaggio
  let seq: number[] = [];
  try { seq = JSON.parse((trip as any).sequence || '[]'); } catch { seq = []; }
  const sorted = seq.length
    ? seq.map(id => orders.find(o => o.id === id)).filter(Boolean) as typeof orders
    : orders;

  const date = (trip as any).date
    ? new Date((trip as any).date).toLocaleDateString('it-IT')
    : new Date().toLocaleDateString('it-IT');
  const opName = sanitize((trip.assignedOperator as any)?.name || (trip.assignedOperator as any)?.username || 'N.A.');

  // Pre-fetch tutti i codici articolo usati negli ordini
  const allCodes = new Set<string>();
  for (const o of sorted) {
    const prods = parseOrderProducts(o);
    for (const p of prods) { if (p.product) allCodes.add(p.product); }
  }
  const articles = await prisma.article.findMany({
    where: { code: { in: [...allCodes] } },
    select: { code: true, name: true },
  });
  const articleMap = new Map(articles.map(a => [a.code, a.name]));

  const parts: Buffer[] = [
    INIT, ALIGN_C,
    BOLD_ON, DBLH_ON, esc('MOLINO BRIGANTI'), DBLH_OFF, BOLD_OFF,
    hr('='),
    esc(ctr(sanitize(`VIAGGIO: ${(trip as any).name || `#${tripId}` }`))),
    esc(ctr(`Data: ${date}`)),
    esc(ctr(`Op.: ${opName}`)),
    hr('='),
    esc(''),
  ];

  let totalColli = 0;
  for (let i = 0; i < sorted.length; i++) {
    const o = sorted[i];
    const c = o.customer as any;
    const clientName = sanitize(c?.name || c?.code || `Ordine #${o.id}`);
    parts.push(BOLD_ON, esc(`${i + 1}. ${clientName}`), BOLD_OFF);
    if (c?.address) parts.push(esc(sanitize(`   ${c.address}, ${c.city || ''}`)));

    const prods = parseOrderProducts(o);
    for (const p of prods) {
      const artName = sanitize(articleMap.get(p.product) || p.product || '?');
      const colli = p.colli ?? p.quantity ?? 0;
      totalColli += Number(colli);
      const nameTrunc = artName.substring(0, LW - 8);
      parts.push(esc('  ' + padLR(`  ${nameTrunc}`, `x${colli}`)));
      const meta: string[] = [];
      if (p.scaffale || p.shelfPosition) meta.push(`📍${p.scaffale || p.shelfPosition}`);
      if (p.batch)    meta.push(`L:${p.batch}`);
      if (p.scadenza) meta.push(`S:${p.scadenza}`);
      if (meta.length) parts.push(esc(`    ${meta.join('  ')}`));
    }
    parts.push(hr('-'));
  }

  parts.push(
    ALIGN_R, BOLD_ON,
    esc(`TOTALE: ${totalColli} colli`),
    BOLD_OFF, ALIGN_L,
    Buffer.from('\n\n\n'),
    CUT,
  );
  return Buffer.concat(parts);
}

// ─── ESC/POS: task (ordine interno / compito / ritiro) ───────────

async function buildEscPosTaskReceipt(taskId: number): Promise<Buffer> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedOperator: true },
  });
  if (!task) throw new Error(`Task #${taskId} non trovato`);

  const title    = task.title || '';
  const desc     = task.description || '';
  const opName   = sanitize((task.assignedOperator as any)?.name || (task.assignedOperator as any)?.username || 'N.A.');
  const date     = task.scheduledAt ? new Date(task.scheduledAt).toLocaleDateString('it-IT') : new Date().toLocaleDateString('it-IT');
  const time     = task.scheduledAt ? new Date(task.scheduledAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';

  const get = (label: string) => {
    const m = desc.match(new RegExp('^\\s*' + label + ':\\s*(.+?)\\s*$', 'mi'));
    return m ? m[1].trim() : '';
  };

  const isInternal = /Ordine interno:/i.test(title);
  const isRitiro   = title.toLowerCase().startsWith('ritiro -');

  const parts: Buffer[] = [INIT, ALIGN_C, BOLD_ON, DBLH_ON, esc('MOLINO BRIGANTI'), DBLH_OFF, BOLD_OFF, hr('=')];

  if (isInternal) {
    const m = title.match(/Ordine interno:\s*(.+?)\s*[×x]\s*(\d+)/i);
    const prodName = m ? sanitize(m[1]) : sanitize(get('Articolo') || title);
    const qty      = m ? parseInt(m[2], 10) : (parseInt(get('Quantità da riordinare'), 10) || 0);
    const code     = get('Codice');
    const wm       = code.match(/-(\d+(?:[.,]\d+)?)$/);
    const wpc      = wm ? parseFloat(wm[1].replace(',', '.')) : 0;
    parts.push(esc(ctr('ORDINE INTERNO')), hr('='), esc(''));
    parts.push(BOLD_ON, esc(ctr(prodName)), BOLD_OFF);
    if (code) parts.push(esc(ctr(`Cod: ${code}`)));
    parts.push(esc(ctr(`Data: ${date}${time ? ' ' + time : ''}`)), esc(ctr(`Op.: ${opName}`)));
    parts.push(hr('-'), ALIGN_C, BOLD_ON, esc(ctr(`${qty} colli`)));
    if (wpc > 0) parts.push(esc(ctr(`${qty} × ${wpc} kg = ${Math.round(qty * wpc * 100) / 100} kg`)));
    parts.push(BOLD_OFF);
    const notes = get('Note');
    if (notes) parts.push(ALIGN_L, esc(`Note: ${sanitize(notes)}`));
  } else if (isRitiro) {
    const cliente = sanitize(title.slice('ritiro - '.length).toUpperCase());
    parts.push(esc(ctr('RITIRO')), esc(ctr(cliente)), hr('='), esc(''));
    parts.push(esc(ctr(`Data: ${date}${time ? ' ' + time : ''}`)), esc(ctr(`Op.: ${opName}`)));
    const prodMatch = desc.match(/Prodotti:\s*([^\n]+)/i);
    if (prodMatch) { parts.push(ALIGN_L, hr('-'), esc(sanitize(prodMatch[1]))); }
    const notes = get('Note');
    if (notes) parts.push(esc(`Note: ${sanitize(notes)}`));
  } else {
    parts.push(esc(ctr('COMPITO')), esc(ctr(sanitize(title.substring(0, LW)))));
    parts.push(hr('='), esc(''));
    parts.push(esc(ctr(`Data: ${date}${time ? ' ' + time : ''}`)), esc(ctr(`Op.: ${opName}`)));
    if (task.priority) parts.push(esc(ctr(`Priorità: ${task.priority}`)));
    if (task.estimatedMinutes) parts.push(esc(ctr(`Durata: ${task.estimatedMinutes} min`)));
  }

  parts.push(hr('='), Buffer.from('\n\n\n'), CUT);
  return Buffer.concat(parts);
}

// ─── ESC/POS: ordine ritiro ──────────────────────────────────────

async function buildEscPosOrderReceipt(orderId: number): Promise<Buffer> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      assignedOperator: true,
      items: { include: { article: { select: { code: true, name: true, weightPerUnit: true } } } },
    },
  });
  if (!order) throw new Error(`Ordine #${orderId} non trovato`);

  const c = order.customer as any;
  const clientName = sanitize(c?.name || c?.code || `Ordine #${orderId}`);
  const opName = sanitize((order.assignedOperator as any)?.name || (order.assignedOperator as any)?.username || 'N.A.');
  const date = new Date().toLocaleDateString('it-IT');

  const prods = parseOrderProducts(order);
  const codes = [...new Set(prods.map(p => p.product).filter(Boolean))];
  const articles = await prisma.article.findMany({
    where: { code: { in: codes } },
    select: { code: true, name: true },
  });
  const articleMap = new Map(articles.map(a => [a.code, a.name]));

  const parts: Buffer[] = [
    INIT, ALIGN_C,
    BOLD_ON, DBLH_ON, esc('MOLINO BRIGANTI'), DBLH_OFF, BOLD_OFF,
    hr('='),
    esc(ctr('ORDINE RITIRO')),
    esc(ctr(clientName)),
    esc(ctr(`Data: ${date}`)),
    esc(ctr(`Op.: ${opName}`)),
    hr('='),
    esc(''),
  ];

  for (const p of prods) {
    const artName = sanitize(articleMap.get(p.product) || p.product || '?');
    const colli = p.colli ?? p.quantity ?? 0;
    parts.push(BOLD_ON, esc(padLR(artName.substring(0, LW - 6), `x${colli}`)), BOLD_OFF);
    const meta: string[] = [];
    if (p.scaffale || p.shelfPosition) meta.push(`📍${p.scaffale || p.shelfPosition}`);
    if (p.batch)    meta.push(`L:${p.batch}`);
    if (p.scadenza) meta.push(`S:${p.scadenza}`);
    if (meta.length) parts.push(esc(`  ${meta.join('  ')}`));
  }

  parts.push(hr('-'), Buffer.from('\n\n\n'), CUT);
  return Buffer.concat(parts);
}

// ─── TSPL: etichetta articolo ─────────────────────────────────────

async function buildTsplLabel(
  articleId: number,
  quantity: number = 1,
  lot?: string,
  expiry?: string,
): Promise<Buffer> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { nutritionalInfo: true },
  });
  if (!article) throw new Error(`Articolo #${articleId} non trovato`);

  const settings = await prisma.companySettings.findMany({
    where: { key: { in: ['companyFullName', 'businessName', 'companyAddress', 'companyCity'] } },
  });
  const gs = (key: string) => settings.find(s => s.key === key)?.value || '';
  const companyName = (gs('companyFullName') || gs('businessName') || 'MOLINO BRIGANTI').toUpperCase();

  const n = (article as any).nutritionalInfo;
  const W = 720; // 90mm × 8dpi (margini inclusi)

  // Pulisce il testo per TSPL (evita `"` e caratteri non ASCII)
  const ts = (s: string) =>
    sanitize(String(s ?? '')).replace(/"/g, "'").substring(0, 50);

  const lines: string[] = [
    'SIZE 100 mm, 150 mm',
    'GAP 3 mm, 0 mm',
    'CLS',
  ];

  let y = 25;

  // Nome azienda
  lines.push(`TEXT 40,${y},"4",0,1,1,"${ts(companyName).substring(0, 22)}"`);
  y += 50;

  lines.push(`BAR 40,${y},${W},2`);
  y += 8;

  // Nome articolo (può spezzarsi su 2 righe)
  const artName = ts(article.name || '').toUpperCase();
  if (artName.length > 22) {
    lines.push(`TEXT 40,${y},"3",0,1,1,"${artName.substring(0, 22)}"`);
    y += 36;
    lines.push(`TEXT 40,${y},"3",0,1,1,"${artName.substring(22, 44)}"`);
    y += 36;
  } else {
    lines.push(`TEXT 40,${y},"4",0,1,1,"${artName.substring(0, 22)}"`);
    y += 50;
  }

  // Categoria / sottocategoria / gruppo
  const taxParts = [article.category, article.subcategory, article.productGroup].filter(Boolean).join(' > ');
  if (taxParts) {
    lines.push(`TEXT 40,${y},"2",0,1,1,"${ts(taxParts).substring(0, 45)}"`);
    y += 28;
  }

  lines.push(`BAR 40,${y},${W},1`);
  y += 8;

  // Valori nutrizionali
  if (n) {
    lines.push(`TEXT 40,${y},"1",0,1,1,"VALORI NUTRIZIONALI MEDI (per 100g):"`);
    y += 22;

    const kcal = n.energyKcal != null ? `${n.energyKcal} kcal` : '';
    const kj   = n.energyKj   != null ? `${n.energyKj} kJ`   : '';
    const energyStr = [kcal, kj].filter(Boolean).join(' / ');
    if (energyStr) { lines.push(`TEXT 40,${y},"2",0,1,1,"Energia: ${ts(energyStr)}"`); y += 26; }

    const pairs: [string, string | null][] = [
      ['Grassi',         n.fat           != null ? `${n.fat} g`                    : null],
      ['Carboidrati',    n.carbohydrates  != null ? `${n.carbohydrates} g`           : null],
      ['di cui zuccheri',n.sugars         != null ? `${n.sugars} g`                 : null],
      ['Fibre',          n.fiber          != null ? `${n.fiber} g`                  : null],
      ['Proteine',       n.protein        != null ? `${n.protein} g`                : null],
      ['Sale',           n.sodium         != null ? `${Number(n.sodium).toFixed(2)} g` : null],
    ];
    const filled = pairs.filter(([, v]) => v != null);
    for (let i = 0; i < filled.length; i += 2) {
      const [l1, v1] = filled[i];
      const right = filled[i + 1];
      lines.push(`TEXT 40,${y},"2",0,1,1,"${ts(`${l1}: ${v1}`)}"`);
      if (right) lines.push(`TEXT 400,${y},"2",0,1,1,"${ts(`${right[0]}: ${right[1]}`)}"`)
      y += 26;
    }

    lines.push(`BAR 40,${y},${W},1`);
    y += 8;
  }

  // Allergeni
  if ((article as any).allergens) {
    const allergenText = ts((article as any).allergens);
    lines.push(`TEXT 40,${y},"2",0,1,1,"${allergenText.substring(0, 45)}"`);
    y += 26;
    if (allergenText.length > 45) {
      lines.push(`TEXT 40,${y},"2",0,1,1,"${allergenText.substring(45, 90)}"`);
      y += 26;
    }
    lines.push(`BAR 40,${y},${W},1`);
    y += 8;
  }

  // Barcode (CODE128)
  const barcodeVal = ts((article as any).barcode || article.code || '');
  if (barcodeVal) {
    lines.push(`BARCODE 40,${y},"CODE128",56,1,0,2,2,"${barcodeVal}"`);
    y += 72;
  }

  // Lotto / scadenza
  const lotStr    = lot    ? `Lotto: ${ts(lot)}`    : '';
  const expiryStr = expiry ? `Scad.: ${ts(expiry)}` : '';
  const lotLine   = [lotStr, expiryStr].filter(Boolean).join('   ');
  if (lotLine) {
    lines.push(`TEXT 40,${y},"2",0,1,1,"${lotLine.substring(0, 45)}"`);
    y += 26;
  }

  lines.push(`PRINT ${Math.max(1, quantity)},1`);

  return Buffer.from(lines.join('\r\n') + '\r\n', 'ascii');
}

// ─── TSPL: test ──────────────────────────────────────────────────

function buildTsplTest(printerName: string): Buffer {
  const now = new Date().toLocaleString('it-IT');
  const lines = [
    'SIZE 100 mm, 150 mm',
    'GAP 3 mm, 0 mm',
    'CLS',
    'TEXT 40,30,"4",0,1,1,"MOLINO BRIGANTI"',
    'BAR 40,85,720,2',
    `TEXT 40,100,"3",0,1,1,"Test etichetta"`,
    `TEXT 40,145,"2",0,1,1,"${sanitize(printerName).replace(/"/g, "'").substring(0, 30)}"`,
    `TEXT 40,180,"2",0,1,1,"${sanitize(now).replace(/"/g, "'")}"`,
    'BAR 40,215,720,1',
    'BARCODE 40,230,"CODE128",56,1,0,2,2,"TEST-MOLINO"',
    'PRINT 1,1',
  ];
  return Buffer.from(lines.join('\r\n') + '\r\n', 'ascii');
}

// ─── Helpers ─────────────────────────────────────────────────────

function parseOrderProducts(order: any): any[] {
  if (!order) return [];
  let raw = order.products;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

// ─── Dispatch pubblico ───────────────────────────────────────────

export interface PrintJobRequest {
  role: string;
  jobType: string;
  data?: {
    tripId?:    number;
    orderId?:   number;
    taskId?:    number;
    articleId?: number;
    quantity?:  number;
    lot?:       string;
    expiry?:    string;
  };
  /** Se true, invia il job a tutte le stampanti il cui ruolo inizia con `role` */
  broadcast?: boolean;
}

/** Esegue un singolo job su una stampante identificata dal ruolo esatto. */
async function executeSingleJob(job: PrintJobRequest): Promise<void> {
  const printer = await prisma.printer.findUnique({ where: { role: job.role } });
  if (!printer) throw new Error(`Nessuna stampante con ruolo "${job.role}"`);
  if (!printer.active) throw new Error(`Stampante "${printer.name}" non attiva`);

  const d = job.data || {};
  let payload: Buffer;

  if (printer.protocol === 'ESCPOS') {
    switch (job.jobType) {
      case 'trip':
        if (!d.tripId) throw new Error('tripId mancante');
        payload = await buildEscPosTripReceipt(d.tripId);
        break;
      case 'pickup_order':
        if (!d.orderId) throw new Error('orderId mancante');
        payload = await buildEscPosOrderReceipt(d.orderId);
        break;
      case 'task_order':
        if (!d.taskId) throw new Error('taskId mancante');
        payload = await buildEscPosTaskReceipt(d.taskId);
        break;
      case 'test':
        payload = buildEscPosTest(printer.name);
        break;
      default:
        throw new Error(`jobType "${job.jobType}" non supportato per ESCPOS`);
    }
  } else if (printer.protocol === 'TSPL') {
    switch (job.jobType) {
      case 'article_label':
        if (!d.articleId) throw new Error('articleId mancante');
        payload = await buildTsplLabel(d.articleId, d.quantity ?? 1, d.lot, d.expiry);
        break;
      case 'test':
        payload = buildTsplTest(printer.name);
        break;
      default:
        throw new Error(`jobType "${job.jobType}" non supportato per TSPL`);
    }
  } else {
    throw new Error(`Protocollo "${printer.protocol}" non supportato`);
  }

  await sendRaw(printer.ip, printer.port, payload);
}

/**
 * Invia un job di stampa.
 * Con broadcast=true cerca tutte le stampanti il cui ruolo inizia con `role`
 * (es. "receipt_80mm" colpisce "receipt_80mm" e "receipt_80mm_ufficio").
 * Gli errori delle singole stampanti vengono raccolti e rilanciate insieme.
 */
export async function executePrintJob(job: PrintJobRequest): Promise<void> {
  if (!job.broadcast) {
    return executeSingleJob(job);
  }

  // Broadcast: tutte le stampanti attive con ruolo che inizia per job.role
  const printers = await prisma.printer.findMany({
    where: { active: true, role: { startsWith: job.role } },
  });
  if (!printers.length) {
    throw new Error(`Nessuna stampante attiva trovata per famiglia ruolo "${job.role}"`);
  }

  const errors: string[] = [];
  await Promise.allSettled(
    printers.map(p =>
      executeSingleJob({ ...job, role: p.role }).catch(e => {
        errors.push(`${p.name}: ${e.message}`);
      }),
    ),
  );
  if (errors.length) throw new Error(errors.join('; '));
}
