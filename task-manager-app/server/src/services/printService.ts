import * as net from 'net';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createCanvas, loadImage } from 'canvas';
import prisma from '../lib/prisma';

// Risolve il nome amichevole del tablet (da tablet-deploy-management.html) a partire dal suo IP locale
export async function resolveTabletNameByIp(ip: string | undefined | null): Promise<string | null> {
  if (!ip) return null;
  try {
    const setting = await prisma.companySettings.findUnique({ where: { key: 'tabletDeployRegistry' } });
    if (!setting?.value) return null;
    const registry = JSON.parse(setting.value);
    const tablets = Array.isArray(registry?.tablets) ? registry.tablets : [];
    const match = tablets.find((t: any) => t.shadowIp === ip || t.prodIp === ip);
    return match?.name || null;
  } catch {
    return null;
  }
}

// ─── Browser pool (Puppeteer) ─────────────────────────────────────

let puppeteerInstance: any = null;

export async function initPuppeteer(): Promise<void> {
  if (puppeteerInstance) return;
  try {
    const puppeteer = await import('puppeteer');
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    };
    try {
      launchOptions.executablePath = '/usr/bin/chromium';
    } catch (e) {}
    puppeteerInstance = await puppeteer.launch(launchOptions);
    console.log('[PRINT] Puppeteer browser pool avviato (riutilizzabile)');
  } catch (err: any) {
    console.error('[PRINT] Errore inizializzazione Puppeteer:', err.message);
    throw err;
  }
}

export async function closePuppeteer(): Promise<void> {
  if (puppeteerInstance) {
    await puppeteerInstance.close();
    puppeteerInstance = null;
  }
}

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

async function decodeRasterImage(imageBase64: string, width: number, whiteBit = false) {
  const raw = imageBase64.replace(/^data:image\/png;base64,/, '');
  const source = await loadImage(Buffer.from(raw, 'base64'));
  const height = Math.max(1, Math.round(source.height * width / source.width));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  // Abilita smoothing (interpolazione) per upscaling nitido
  context.imageSmoothingEnabled = true;
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const widthBytes = Math.ceil(width / 8);
  const bitmap = Buffer.alloc(widthBytes * height, whiteBit ? 0xff : 0x00);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const gray = 0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2];
      const byteIndex = y * widthBytes + Math.floor(x / 8);
      const bitMask = 0x80 >> (x % 8);
      if (whiteBit) {
        if (gray < 180) bitmap[byteIndex] &= ~bitMask;
      } else if (gray < 180) {
        bitmap[byteIndex] |= bitMask;
      }
    }
  }
  return { widthBytes, height, bitmap };
}

// Rasterizza HTML con Puppeteer a PNG base64 per stampa 80mm
export async function rasterizeHtmlToPng(contentHtml: string, width: number = 576): Promise<string> {
  if (!puppeteerInstance) await initPuppeteer();
  let page;
  try {
    console.log('[PRINT] rasterizeHtmlToPng: creando pagina...');
    page = await puppeteerInstance.newPage();
    await page.setViewport({ width: 264, height: 10000, deviceScaleFactor: 2 });
    
    let fullHtml = contentHtml;
    if (!contentHtml.toUpperCase().includes('<!DOCTYPE')) {
      fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${width}px; background: white; color: black; font-family: sans-serif; }
    .rcpt-logo { max-width: 100%; height: auto; display: block; margin: 0 auto 8px; }
    .rcpt-title { font-size: 18px; font-weight: bold; text-align: center; margin: 8px 0; }
    .rcpt-sub { font-size: 16px; font-weight: bold; text-align: center; margin: 8px 0; }
    .rcpt-info-row { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }
    .rcpt-info-row .lbl { font-weight: bold; }
    .rcpt-info-row .val { text-align: right; }
    .rcpt-section { font-size: 14px; font-weight: bold; text-align: center; margin: 8px 0; }
    .rcpt-total { display: flex; justify-content: space-between; font-size: 13px; margin: 8px 0; }
    .rcpt-notes { font-size: 12px; margin: 8px 0; }
  </style>
</head>
<body>
${contentHtml}
</body>
</html>`;
    } else {
      // Il contentHtml ha già DOCTYPE + CSS client (con width: 70mm)
      // Con deviceScaleFactor: 2, il CSS mm viene raddoppiato fisicamente
      // Forza width: 264px (px, non mm) per evitare il raddoppio
      // Inserisci PRIMA di </body> per vincere sulla cascata CSS
      const overrideStyle = `<style>html, body { width: 264px !important; max-width: none !important; }</style>`;
      fullHtml = contentHtml.replace('</body>', overrideStyle + '</body>');
    }
    
    console.log('[PRINT] rasterizeHtmlToPng: settando content (lunghezza:', fullHtml.length, ')...');
    await page.setContent(fullHtml, { waitUntil: 'networkidle2' });
    
    // Misura l'altezza reale del body (contentHeight)
    const contentHeight = await page.evaluate(() => {
      const body = document.body;
      return body.scrollHeight || body.offsetHeight || 100;
    });
    console.log('[PRINT] rasterizeHtmlToPng: altezza contenuto:', contentHeight, 'px');
    
    console.log('[PRINT] rasterizeHtmlToPng: catturando screenshot...');
    // Cattura il clip rect esatto del contenuto (no carta bianca)
    // Con deviceScaleFactor: 2, clip a 264px logici = 528px fisici
    const screenshot = await page.screenshot({ 
      encoding: 'base64', 
      clip: { x: 0, y: 0, width: 264, height: contentHeight }
    });
    console.log('[PRINT] rasterizeHtmlToPng: screenshot OK, lunghezza:', screenshot.length);
    return `data:image/png;base64,${screenshot}`;
  } catch (err) {
    console.error('[PRINT] rasterizeHtmlToPng ERROR:', err);
    throw new Error(`Rasterizzazione HTML fallita: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.warn('[PRINT] Errore chiusura page:', e instanceof Error ? e.message : String(e));
      }
    }
  }
}

async function buildEscPosRaster(imageBase64: string): Promise<Buffer> {
  const { widthBytes, height, bitmap } = await decodeRasterImage(imageBase64, 576);
  const header = Buffer.from([GS, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff]);
  return Buffer.concat([INIT, ALIGN_L, header, bitmap, Buffer.from('\n\n\n'), CUT]);
}

async function buildTsplRaster(imageBase64: string, copies: number): Promise<Buffer> {
  const { widthBytes, height, bitmap } = await decodeRasterImage(imageBase64, 1200, true);
  const prefix = Buffer.from(`SIZE 101.6 mm, 152.4 mm\r\nGAP 3 mm, 0 mm\r\nDIRECTION 1\r\nREFERENCE 0,0\r\nOFFSET 0 mm\r\nCLS\r\nBITMAP 0,0,${widthBytes},${height},0,`, 'ascii');
  return Buffer.concat([prefix, bitmap, Buffer.from(`\r\nPRINT ${Math.max(1, Math.min(9999, Math.floor(copies || 1)))},1\r\n`, 'ascii')]);
}

async function decodeImageToBitmap(sourceBuffer: Buffer, maxWidth: number, maxHeight: number) {
  const source = await loadImage(sourceBuffer);
  const scale = Math.min(maxWidth / source.width, maxHeight / source.height, 1);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const widthBytes = Math.ceil(width / 8);
  const bitmap = Buffer.alloc(widthBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3] / 255;
      const red = pixels[offset] * alpha + 255 * (1 - alpha);
      const green = pixels[offset + 1] * alpha + 255 * (1 - alpha);
      const blue = pixels[offset + 2] * alpha + 255 * (1 - alpha);
      const gray = 0.299 * red + 0.587 * green + 0.114 * blue;
      if (gray < 170) bitmap[y * widthBytes + Math.floor(x / 8)] |= 0x80 >> (x % 8);
    }
  }
  return { width, widthBytes, height, bitmap };
}

async function loadLogoBitmap(logoUrl: string, maxWidth: number, maxHeight: number) {
  if (!logoUrl) return null;
  try {
    let buffer: Buffer;
    if (/^data:image\//i.test(logoUrl)) {
      const base64 = logoUrl.replace(/^data:image\/[^;]+;base64,/, '');
      buffer = Buffer.from(base64, 'base64');
    } else if (/^https?:\/\//i.test(logoUrl)) {
      const response = await fetch(logoUrl);
      if (!response.ok) return null;
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      const publicPath = path.resolve(__dirname, '../../../public', logoUrl.replace(/^\//, ''));
      buffer = await fs.readFile(publicPath);
    }
    return await decodeImageToBitmap(buffer, maxWidth, maxHeight);
  } catch {
    return null;
  }
}

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

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseSettingValue(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : String(parsed ?? '');
  } catch {
    return value;
  }
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
  let opName   = sanitize((task.assignedOperator as any)?.name || (task.assignedOperator as any)?.username || 'N.A.');
  let date     = task.scheduledAt ? new Date(task.scheduledAt).toLocaleDateString('it-IT') : new Date().toLocaleDateString('it-IT');
  let time     = task.scheduledAt ? new Date(task.scheduledAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';

  const get = (label: string) => {
    const m = desc.match(new RegExp('^\\s*' + label + ':\\s*(.+?)\\s*$', 'mi'));
    return m ? m[1].trim() : '';
  };

  const isInternal = /Ordine interno:/i.test(title);
  const isRitiro   = title.toLowerCase().startsWith('ritiro -');

  const parts: Buffer[] = [INIT, ALIGN_C];
  
  if (isInternal) {
    const m = title.match(/Ordine interno:\s*(.+?)\s*[×x]\s*(\d+)/i);
    const prodName = m ? sanitize(m[1]) : sanitize(get('Articolo') || title);
    const qty      = m ? parseInt(m[2], 10) : (parseInt(get('Quantità da riordinare'), 10) || 0);
    const code     = get('Codice');
    const wm       = code.match(/-(\d+(?:[.,]\d+)?)$/);
    const wpc      = wm ? parseFloat(wm[1].replace(',', '.')) : 0;
    const category = get('Categoria');
    const priority = task.priority || get('Priorità');
    const notes    = get('Note');
    
    parts.push(ALIGN_C, hr('='));
    parts.push(BOLD_ON, DBLH_ON, esc('ORDINE INT.'), DBLH_OFF, BOLD_OFF);
    parts.push(hr('='));
    parts.push(ALIGN_C, BOLD_ON, DBLH_ON, esc(ctr(prodName.substring(0, LW - 4))), DBLH_OFF, BOLD_OFF);
    parts.push(hr('-'));
    parts.push(ALIGN_L);
    if (code) parts.push(BOLD_ON, esc(padLR('CODICE', code)), BOLD_OFF);
    if (category) parts.push(BOLD_ON, esc(padLR('CATEGORIA', sanitize(category))), BOLD_OFF);
    parts.push(BOLD_ON, esc(padLR('DATA', `${date}${time ? ' ' + time : ''}`)), BOLD_OFF);
    parts.push(BOLD_ON, esc(padLR('OPERATORE', opName)), BOLD_OFF);
    if (priority) parts.push(BOLD_ON, esc(padLR('PRIORITA', sanitize(priority))), BOLD_OFF);
    parts.push(hr('='));
    parts.push(ALIGN_C, BOLD_ON, DBLH_ON, esc('QUANTITA DA'), esc('RIORDINARE'), DBLH_OFF, BOLD_OFF);
    parts.push(hr('-'));
    const qtyLine = wpc > 0 ? padLR(`${qty} colli`, `${qty} x ${wpc} kg`) : `${qty} colli`;
    parts.push(ALIGN_L, esc(qtyLine));
    if (wpc > 0) {
      const totalKg = Math.round(qty * wpc * 100) / 100;
      parts.push(ALIGN_R, esc(String(totalKg) + ' kg'), ALIGN_L);
    }
    if (notes) parts.push(ALIGN_L, hr('-'), esc(`Note: ${sanitize(notes)}`));
  } else if (isRitiro) {
    const cliente = sanitize(title.slice('ritiro - '.length).toUpperCase());
    parts.push(esc(ctr('RITIRO')), esc(ctr(cliente)), hr('='), esc(''));
    parts.push(esc(ctr(`Data: ${date}${time ? ' ' + time : ''}`)), esc(ctr(`Op.: ${opName}`)));
    const prodMatch = desc.match(/Prodotti:\s*([^\n]+)/i);
    if (prodMatch) { parts.push(ALIGN_L, hr('-'), esc(sanitize(prodMatch[1]))); }
    const ritiroNotes = get('Note');
    if (ritiroNotes) parts.push(esc(`Note: ${sanitize(ritiroNotes)}`));
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
  const layout = await buildTsplLabelLayout(articleId, lot, expiry);
  return Buffer.concat([...layout.parts, Buffer.from(`PRINT ${Math.max(1, quantity)},1\r\n`, 'ascii')]);
}

type TsplPreviewElement =
  | { kind: 'text'; x: number; y: number; font: string; scaleX: number; scaleY: number; text: string }
  | { kind: 'bar'; x: number; y: number; width: number; height: number }
  | { kind: 'barcode'; x: number; y: number; height: number; value: string }
  | { kind: 'image'; x: number; y: number; width: number; height: number; src: string };

async function buildTsplLabelLayout(articleId: number, lot?: string, expiry?: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { nutritionalInfo: true },
  });
  if (!article) throw new Error(`Articolo #${articleId} non trovato`);

  const settings = await prisma.companySettings.findMany({
    where: { key: { in: [
      'companyFullName', 'businessName', 'companyAddress', 'companyCAP', 'companyCity', 'companyProvince',
      'companyPhone', 'companyMobile', 'companyEmail', 'companyWebsite', 'logoThermalUrl', 'logoUrl',
    ] } },
  });
  const gs = (key: string) => parseSettingValue(settings.find(s => s.key === key)?.value);
  const companyName = (gs('companyFullName') || gs('businessName') || 'MOLINO BRIGANTI').toUpperCase();

  const n = (article as any).nutritionalInfo;
  const W = 752; // 94mm x 8dpi: margini ~3mm come stampa Windows
  const elements: TsplPreviewElement[] = [];
  const mm = (value: number) => Math.round(value * 8);
  const LEFT = mm(3);
  const RIGHT = LEFT + W;

  const ts = (s: string, max = 80) => sanitize(String(s ?? '')).replace(/"/g, "'").substring(0, max);
  const parts: Buffer[] = [];
  const command = (line: string) => parts.push(Buffer.from(line + '\r\n', 'ascii'));
  command('SIZE 100 mm, 150 mm');
  command('GAP 3 mm, 0 mm');
  command('CLS');
  const addText = (x: number, y: number, font: string, scaleX: number, scaleY: number, text: string, max = 80) => {
    const value = ts(text, max);
    command(`TEXT ${x},${y},"${font}",0,${scaleX},${scaleY},"${value}"`);
    elements.push({ kind: 'text', x, y, font, scaleX, scaleY, text: value });
  };
  const charWidthByFont: Record<string, number> = { '1': 8, '2': 14, '3': 22, '4': 32 };
  const addCenteredText = (y: number, font: string, scaleX: number, scaleY: number, text: string, maxChars: number) => {
    const value = ts(text, maxChars);
    const approxWidth = Math.min(W, value.length * (charWidthByFont[font] || 12) * scaleX);
    addText(Math.max(LEFT, Math.round(LEFT + (W - approxWidth) / 2)), y, font, scaleX, scaleY, value);
  };
  const addFittedCenteredText = (y: number, preferredFont: string, text: string, maxChars: number) => {
    const value = ts(text, maxChars);
    const font = value.length > 28 ? '2' : preferredFont;
    addCenteredText(y, font, 1, 1, value, maxChars);
  };
  const addBar = (x: number, y: number, width: number, height: number) => {
    command(`BAR ${x},${y},${width},${height}`);
    elements.push({ kind: 'bar', x, y, width, height });
  };
  const addRect = (x: number, y: number, width: number, height: number, stroke = 3) => {
    addBar(x, y, width, stroke);
    addBar(x, y + height - stroke, width, stroke);
    addBar(x, y, stroke, height);
    addBar(x + width - stroke, y, stroke, height);
  };
  const addBarcode = (x: number, y: number, height: number, value: string) => {
    const cleanValue = ts(value);
    command(`BARCODE ${x},${y},"CODE128",${height},1,0,2,2,"${cleanValue}"`);
    elements.push({ kind: 'barcode', x, y, height, value: cleanValue });
  };
  const addWrappedText = (x: number, y: number, font: string, text: string, maxChars: number, maxLines: number, lineHeight: number) => {
    const words = ts(text, maxChars * maxLines + maxLines).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChars) {
        if (current) lines.push(current);
        current = word.substring(0, maxChars);
      } else {
        current = candidate;
      }
      if (lines.length >= maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);
    lines.forEach((line, index) => addText(x, y + index * lineHeight, font, 1, 1, line, maxChars));
    return y + lines.length * lineHeight;
  };
  const fmt = (value: unknown, decimals?: number) => {
    if (value == null || value === '') return '';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    const rounded = decimals == null ? numeric : Number(numeric.toFixed(decimals));
    return String(rounded).replace('.', ',');
  };
  const logoUrl = gs('logoThermalUrl') || gs('logoUrl') || 'images/logo INSEGNA.png';
  const logoBitmap = await loadLogoBitmap(logoUrl, mm(45), mm(24));
  const taxonomy = article.category ? await prisma.productCategory.findUnique({
    where: { name: article.category },
    include: {
      subcategories: {
        where: { name: article.subcategory || '' },
        include: { groups: { where: { name: article.productGroup || '' } } },
      },
    },
  }) : null;
  const subcategory = taxonomy?.subcategories?.[0] || null;
  const group = subcategory?.groups?.[0] || null;
  const displayName = (group?.description || article.name || '').toUpperCase();
  const hierarchyDescriptions = [subcategory?.description, taxonomy?.description]
    .filter((value, index, values): value is string => Boolean(value) && value !== displayName && values.indexOf(value) === index);

  if (logoBitmap) {
    const logoX = Math.max(LEFT, Math.round(LEFT + (W - logoBitmap.width) / 2));
    command(`BITMAP ${logoX},${mm(3)},${logoBitmap.widthBytes},${logoBitmap.height},0,`);
    parts.push(logoBitmap.bitmap, Buffer.from('\r\n', 'ascii'));
    elements.push({ kind: 'image', x: logoX, y: mm(3), width: logoBitmap.width, height: logoBitmap.height, src: logoUrl });
  } else {
    addCenteredText(mm(7), '4', 1, 1, companyName.substring(0, 26), 26);
  }

  const nameLines = displayName.length > 26 ? [displayName.substring(0, 26), displayName.substring(26, 52)] : [displayName];
  nameLines.filter(Boolean).slice(0, 2).forEach((line, index) => {
    addFittedCenteredText(mm(42 + index * 7), '4', line, 30);
  });

  hierarchyDescriptions.slice(0, 2).forEach((description, index) => {
    addFittedCenteredText(mm(51 + index * 5.5), '2', description.toUpperCase(), 44);
  });

  const weight = Number(article.weightPerUnit) > 0 ? `${Number(article.weightPerUnit).toLocaleString('it-IT')} Kg` : '';
  if (weight) {
    addCenteredText(mm(67), '4', 1, 1, `${weight} e`, 14);
  }

  let y = mm(79);

  if (n) {
    addBar(LEFT, y, W, 2);
    addBar(LEFT, y + mm(5), W, 2);
    addText(LEFT + mm(5), y + mm(1.1), '1', 1, 1, 'DICHIARAZIONE NUTRIZIONALE PER 100 G DI PRODOTTO', 54);
    y += mm(6.2);

    const kcal = n.energyKcal != null ? `${Math.round(Number(n.energyKcal))} kcal` : '';
    const kj   = n.energyKj   != null ? `${Math.round(Number(n.energyKj))} kJ`   : '';
    const energyStr = [kcal, kj].filter(Boolean).join(' / ');
    if (energyStr) addText(LEFT + mm(1), y, '1', 1, 1, `Valore energetico ${energyStr}`, 42);
    y += mm(4);
    addBar(LEFT, y - mm(0.7), W, 1);
    if (n.fat != null) addText(LEFT + mm(1), y, '1', 1, 1, `Grassi ${fmt(n.fat)} g`, 30);
    if (n.saturatedFat != null) addText(LEFT + mm(54), y, '1', 1, 1, `di cui saturi ${fmt(n.saturatedFat)} g`, 34);
    y += mm(4);
    addBar(LEFT, y - mm(0.7), W, 1);
    if (n.carbohydrates != null) addText(LEFT + mm(1), y, '1', 1, 1, `Carboidrati ${fmt(n.carbohydrates)} g`, 32);
    if (n.sugars != null) addText(LEFT + mm(54), y, '1', 1, 1, `di cui zuccheri ${fmt(n.sugars)} g`, 34);
    y += mm(4);
    addBar(LEFT, y - mm(0.7), W, 1);
    if (n.fiber != null) addText(LEFT + mm(1), y, '1', 1, 1, `Fibre ${fmt(n.fiber)} g`, 24);
    if (n.protein != null) addText(LEFT + mm(37), y, '1', 1, 1, `Proteine ${fmt(n.protein)} g`, 26);
    if (n.sodium != null) addText(LEFT + mm(72), y, '1', 1, 1, `Sodio ${fmt(n.sodium, 2)} g`, 24);
    y += mm(4.8);
  }

  if ((article as any).allergens) {
    const boxY = mm(104);
    addRect(LEFT, boxY, W, mm(6), 2);
    addWrappedText(LEFT + mm(1), boxY + mm(1.4), '1', `Allergeni: ${String((article as any).allergens).replace(/^\s*Contiene\s*:\s*/i, '').replace(/\.\s*Può contenere tracce di\s*:\s*/i, ', puo contenere tracce di ').replace(/\s*\.\s*$/, '')}.`, 88, 1, mm(3.4));
  }

  y = mm(112);
  addText(LEFT + mm(8), y, '1', 1, 1, 'Umidita: 15% max - Merce soggetta a calo naturale - Conservare in luogo fresco e asciutto', 82);
  y += mm(5);

  const address = [
    gs('companyAddress'),
    [gs('companyCAP'), gs('companyCity')].filter(Boolean).join(' '),
    gs('companyProvince') ? `(${gs('companyProvince')})` : '',
  ].filter(Boolean).join(', ');
  const supplierName = String((article as any).supplierName || '').trim();
  const supplierRea = String((article as any).supplierRea || '').trim();
  addBar(LEFT, y, W, 2);
  y += mm(1.2);
  if (supplierRea) {
    addFittedCenteredText(y, '1', `Prodotto dalla ditta: ${supplierName} - REA ${supplierRea}`, 66);
    y += mm(3.4);
    addFittedCenteredText(y, '1', `Confezionato da: ${companyName}`, 66);
    y += mm(3.4);
    if (address) addFittedCenteredText(y, '1', address, 66);
    y += address ? mm(3.4) : 0;
  } else {
    addFittedCenteredText(y, '1', `Prodotto e confezionato da: ${companyName}`, 66);
    y += mm(3.4);
    if (address) addFittedCenteredText(y, '1', address, 66);
    y += address ? mm(3.4) : 0;
  }
  const phones = [gs('companyPhone') ? `Tel. ${gs('companyPhone')}` : '', gs('companyMobile') ? `Cell. ${gs('companyMobile')}` : ''].filter(Boolean).join(' - ');
  if (phones) addCenteredText(y, '2', 1, 1, phones, 58);
  y += phones ? mm(5) : 0;
  if (gs('companyEmail')) addCenteredText(y, '2', 1, 1, gs('companyEmail'), 48);
  y += gs('companyEmail') ? mm(5) : 0;
  if (gs('companyWebsite')) addCenteredText(y, '3', 1, 1, gs('companyWebsite'), 38);

  const lotStr    = lot    ? `Lotto: ${ts(lot)}`    : '';
  const expiryStr = expiry ? `Scad.: ${ts(expiry)}` : '';
  const lotY = mm(140);
  addBar(LEFT, lotY, W, 2);
  if (lotStr) addText(LEFT, lotY + mm(3), '3', 1, 1, lotStr, 26);
  if (expiryStr) {
    const value = ts(expiryStr, 26);
    const approxWidth = value.length * (charWidthByFont['3'] || 22);
    addText(Math.max(LEFT, RIGHT - approxWidth), lotY + mm(3), '3', 1, 1, value, 26);
  }

  return { parts, elements };
}

export async function buildTsplLabelPreviewHtml(articleId: number, lot?: string, expiry?: string): Promise<string> {
  const layout = await buildTsplLabelLayout(articleId, lot, expiry);
  const fontSizeByTsplFont: Record<string, number> = { '1': 7.5, '2': 10, '3': 14, '4': 20 };
  const mm = (dots: number) => `${dots / 8}mm`;
  const elementsHtml = layout.elements.map((element) => {
    if (element.kind === 'image') {
      return `<img class="tspl-image" src="${escapeHtml(element.src)}" alt="Logo" style="left:${mm(element.x)};top:${mm(element.y)};width:${mm(element.width)};height:${mm(element.height)};">`;
    }
    if (element.kind === 'bar') {
      return `<div class="tspl-bar" style="left:${mm(element.x)};top:${mm(element.y)};width:${mm(element.width)};height:${mm(element.height)};"></div>`;
    }
    if (element.kind === 'barcode') {
      return `<div class="tspl-barcode" style="left:${mm(element.x)};top:${mm(element.y)};height:${mm(element.height)};">
        <div class="tspl-bars"></div><div class="tspl-code">${escapeHtml(element.value)}</div>
      </div>`;
    }
    const size = (fontSizeByTsplFont[element.font] || 12) * element.scaleY;
    return `<div class="tspl-text" style="left:${mm(element.x)};top:${mm(element.y)};font-size:${size}pt;transform:scaleX(${element.scaleX});transform-origin:left top;">${escapeHtml(element.text)}</div>`;
  }).join('');

  return `<!doctype html><html lang="it"><head><meta charset="UTF-8">
<title>Anteprima etichetta RAW TSPL</title>
<style>
  @page { size: 100mm 150mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: 100mm; height: 150mm; font-family: Arial, Helvetica, sans-serif; }
  .tspl-label { position: relative; width: 100mm; height: 150mm; overflow: hidden; background: #fff; }
  .tspl-text { position: absolute; max-width: 94mm; white-space: nowrap; overflow: hidden; text-overflow: clip; font-weight: 700; line-height: 1; }
  .tspl-image { position: absolute; object-fit: contain; filter: grayscale(1) contrast(1.25); }
  .tspl-bar { position: absolute; background: #000; }
  .tspl-barcode { position: absolute; width: 64mm; }
  .tspl-bars { height: calc(100% - 5mm); background: repeating-linear-gradient(90deg,#000 0 0.45mm,#fff 0.45mm 0.75mm,#000 0.75mm 1.2mm,#fff 1.2mm 1.6mm); border-left: 0.3mm solid #000; border-right: 0.3mm solid #000; }
  .tspl-code { font-size: 8pt; font-weight: 700; text-align: center; line-height: 5mm; white-space: nowrap; }
</style></head><body><div class="tspl-label">${elementsHtml}</div></body></html>`;
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
    imageBase64?: string;
    contentHtml?: string;
    copies?: number;
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

  if (d.imageBase64) {
    if (printer.protocol === 'ESCPOS') payload = await buildEscPosRaster(d.imageBase64);
    else if (printer.protocol === 'TSPL') payload = await buildTsplRaster(d.imageBase64, d.copies ?? 1);
    else throw new Error(`Protocollo "${printer.protocol}" non supportato`);
    await sendRaw(printer.ip, printer.port, payload);
    return;
  }

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
      case 'html_raster':
        if (!d.contentHtml) throw new Error('contentHtml mancante');
        console.log('[PRINT] Job html_raster ricevuto, contentHtml length:', d.contentHtml.length);
        const pngBase64 = await rasterizeHtmlToPng(d.contentHtml, 576);
        console.log('[PRINT] html_raster rasterizzazione OK, building ESC/POS...');
        payload = await buildEscPosRaster(pngBase64);
        console.log('[PRINT] html_raster ESC/POS built, payload size:', payload.length);
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
