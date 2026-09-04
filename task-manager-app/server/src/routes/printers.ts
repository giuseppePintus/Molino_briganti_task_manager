import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { buildTsplLabelPreviewHtml, executePrintJob, rasterizeHtmlToPng, PrintJobRequest } from '../services/printService';
import * as jwt from 'jsonwebtoken';

const router = Router();

// CSS termico identico a thermal-print.js THERMAL_CSS (senza @page per WebView)
const THERMAL_CSS_SERVER = `
  *{box-sizing:border-box}
  html,body{margin:0;padding:4px;font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.25;color:#000;background:#fff;word-break:break-word}
  body{max-width:320px;width:100%;margin:0 auto}
  .rcpt-logo{display:block;max-width:42mm;max-height:17.5mm;width:auto;height:auto;margin:3px auto 2px}
  .rcpt-title{font-size:20pt;font-weight:900;text-align:center;letter-spacing:2px;padding:3px 0;border-top:.6mm solid #000;border-bottom:.6mm solid #000}
  .rcpt-sub{font-size:13pt;font-weight:800;text-align:center;padding:3px 2px;border-bottom:.3mm solid #000;word-break:break-word}
  .rcpt-info{font-size:10pt;padding:3px 2px;border-bottom:.6mm solid #000}
  .rcpt-info-row{display:flex;justify-content:space-between;gap:4px;line-height:1.4}
  .rcpt-info-row .lbl{font-weight:800;text-transform:uppercase;font-size:9pt;white-space:nowrap}
  .rcpt-info-row .val{font-weight:700;text-align:right;flex:1}
  .rcpt-section{font-size:11pt;font-weight:900;text-align:center;letter-spacing:2px;padding:2px;border-bottom:.3mm solid #000;text-transform:uppercase}
  .rcpt-prod{padding:3px 2px;border-top:.3mm dashed #000}
  .rcpt-prod:first-child{border-top:none}
  .rcpt-prod-name{display:block;font-size:12pt;font-weight:900;line-height:1.2;margin-bottom:2px}
  .rcpt-prod-code{display:block;font-size:9pt;font-weight:700;color:#444;margin-bottom:2px;letter-spacing:0.5px}
  .rcpt-prod-row2{display:flex;align-items:center;gap:3px;margin-bottom:2px}
  .rcpt-prod-shelf{font-size:12pt;font-weight:900;background:#000;color:#fff;padding:1px 4px;border-radius:2px}
  .rcpt-prod-colli{font-size:12pt;font-weight:900;border:.5mm solid #000;padding:1px 3px;border-radius:2px}
  .rcpt-prod-kg{margin-left:auto;font-size:10pt;font-weight:800;white-space:nowrap}
  .rcpt-prod-row3{display:flex;gap:3px;flex-wrap:wrap;font-size:9pt;font-weight:700}
  .rcpt-prod-row3 .r3-item{border:.3mm solid #000;padding:0 2px;border-radius:2px}
  .rcpt-total{padding:4px 2px;border-top:.6mm solid #000;border-bottom:.6mm solid #000;display:flex;justify-content:space-between;align-items:baseline;gap:4px}
  .rcpt-total .lbl{font-size:14pt;font-weight:900;letter-spacing:2px}
  .rcpt-total .val{font-size:13pt;font-weight:900;text-align:right}
  .rcpt-footer{font-size:8pt;text-align:center;padding:4px 2px 12px}
`;

// POST /api/printers/receipt-preview/draft — anteprima senza creare l'ordine
// Accetta righe locali, restituisce HTML; non scrive nulla nel DB
router.post('/receipt-preview/draft', async (req: Request, res: Response) => {
  const token = (req.query.t as string) || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).send('Token mancante');
  try { jwt.verify(token, process.env.JWT_SECRET || 'secret'); } catch { return res.status(401).send('Token non valido'); }

  const { clientName, operatorName, lines } = req.body as {
    clientName?: string;
    operatorName?: string;
    lines: Array<{ articleName: string; articleCode: string; quantity: number; positionCode?: string; batch?: string }>;
  };

  if (!Array.isArray(lines) || !lines.length) return res.status(400).send('lines obbligatorio');

  try {
    const settings = await prisma.companySettings.findMany({
      where: { key: { in: ['logoThermalUrl', 'logoUrl', 'businessName', 'companyFullName'] } },
    });
    const gs = (k: string) => settings.find(s => s.key === k)?.value || '';
    const rawLogo = gs('logoThermalUrl') || gs('logoUrl') || '/images/logo INSEGNA.png';
    const serverBase = req.protocol + '://' + req.get('host');
    const logoUrl = rawLogo.startsWith('http') || rawLogo.startsWith('data:')
      ? rawLogo
      : serverBase + (rawLogo.startsWith('/') ? '' : '/') + rawLogo;

    const now = new Date();
    const fmtDate = (d: Date) => d.toLocaleDateString('it-IT');
    const fmtTime = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    let totalColli = 0, totalKg = 0;
    const prodHtml = lines.map(l => {
      const colli = Number(l.quantity) || 0;
      const kg = colli; // quantity da Android è già in colli, kg sconosciuto senza weightPerUnit
      totalColli += colli;
      const pos = l.positionCode || '';
      const batch = l.batch || '';
      const shelfBadge = pos ? `<span class="rcpt-prod-shelf">${pos}</span>` : '';
      const r3 = batch ? `<div class="rcpt-prod-row3"><span class="r3-item">L.&nbsp;${batch}</span></div>` : '';
      return `<div class="rcpt-prod">
        <span class="rcpt-prod-name">${l.articleName || l.articleCode || '?'}</span>
        ${l.articleCode ? `<span class="rcpt-prod-code">${l.articleCode}</span>` : ''}
        <div class="rcpt-prod-row2">${shelfBadge}
          <span class="rcpt-prod-colli">${colli}&nbsp;Colli</span>
        </div>${r3}
      </div>`;
    }).join('');

    const html = `<!doctype html><html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anteprima ordine</title>
<style>${THERMAL_CSS_SERVER}</style>
</head><body>
<img class="rcpt-logo" src="${logoUrl}" alt="Logo" onerror="this.style.display='none'">
<div class="rcpt-title">ORDINE RAPIDO</div>
<div class="rcpt-sub">${clientName || 'Banco'}</div>
<div class="rcpt-info">
  <div class="rcpt-info-row"><span class="lbl">Data</span><span class="val">${fmtDate(now)}</span></div>
  <div class="rcpt-info-row"><span class="lbl">Ora</span><span class="val">${fmtTime(now)}</span></div>
  ${operatorName ? `<div class="rcpt-info-row"><span class="lbl">Operatore</span><span class="val">${operatorName}</span></div>` : ''}
</div>
<div class="rcpt-section">PRODOTTI</div>
${prodHtml}
<div class="rcpt-total">
  <span class="lbl">TOTALE</span>
  <span class="val">${totalColli} colli</span>
</div>
<div class="rcpt-footer">Anteprima — non ancora confermato</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).send('Errore: ' + err.message);
  }
});

// GET /api/printers/receipt-preview/order/:orderId?t=TOKEN
// Restituisce HTML stilizzato dell'ordine per WebView Android (token in query)
router.get('/receipt-preview/order/:orderId', async (req: Request, res: Response) => {
  const token = (req.query.t as string) || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).send('Token mancante');
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'secret');
  } catch {
    return res.status(401).send('Token non valido');
  }

  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) return res.status(400).send('orderId non valido');

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        assignedOperator: true,
        items: { include: { article: true } },
      },
    });
    if (!order) return res.status(404).send('Ordine non trovato');

    const settings = await prisma.companySettings.findMany({
      where: { key: { in: ['logoThermalUrl', 'logoUrl', 'businessName', 'companyFullName'] } },
    });
    const gs = (k: string) => settings.find(s => s.key === k)?.value || '';
    const rawLogo2 = gs('logoThermalUrl') || gs('logoUrl') || '/images/logo INSEGNA.png';
    const serverBase2 = req.protocol + '://' + req.get('host');
    const logoUrl = rawLogo2.startsWith('http') || rawLogo2.startsWith('data:')
      ? rawLogo2
      : serverBase2 + (rawLogo2.startsWith('/') ? '' : '/') + rawLogo2;
    const businessName = gs('businessName') || gs('companyFullName') || 'Molino Briganti';

    const c = order.customer as any;
    const clientName = c?.name || c?.code || `Ordine #${orderId}`;
    const opName = (order.assignedOperator as any)?.name || (order.assignedOperator as any)?.username || 'N.A.';
    const dt = new Date();
    const fmtDate = (d: Date) => d.toLocaleDateString('it-IT');
    const fmtTime = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    // Parse products: from JSON field or from OrderItem relation
    let prods: any[] = [];
    try { const raw = order.products; if (raw) prods = JSON.parse(raw as string); } catch {}
    if (!prods.length && (order as any).items?.length) {
      prods = (order as any).items.map((it: any) => ({
        product: it.article?.name || it.article?.code || `#${it.articleId}`,
        quantity: it.quantityOrdered,
        colli: it.quantityOrdered,
        shelfPosition: null, batch: null, expiry: null,
      }));
    }

    // Risolve nomi articolo da codice se necessario
    const codes = prods.map(p => p.product).filter(Boolean);
    const articles = await prisma.article.findMany({
      where: { code: { in: codes } },
      select: { code: true, name: true, weightPerUnit: true },
    });
    const artMap = new Map(articles.map(a => [a.code, a]));

    let totalColli = 0, totalKg = 0;
    const prodHtml = prods.map(p => {
      const art = artMap.get(p.product);
      const name = art?.name || p.product || '?';
      const qtyKg = Number(p.quantity) || 0;
      const wpc = art?.weightPerUnit || 1;
      const colli = p.colli ?? (wpc > 0 ? Math.round(qtyKg / wpc) : 0);
      totalKg += qtyKg; totalColli += colli;
      const pos   = p.shelfPosition || p.scaffale || '';
      const batch = p.batch || '';
      const exp   = p.expiry || p.scadenza || '';
      const shelfBadge = pos ? `<span class="rcpt-prod-shelf">${pos}</span>` : '';
      const r3 = [batch ? `<span class="r3-item">L.&nbsp;${batch}</span>` : '',
                  exp   ? `<span class="r3-item">Sc.&nbsp;${exp}</span>`   : ''].filter(Boolean).join('');
      return `<div class="rcpt-prod">
        <span class="rcpt-prod-name">${name}</span>
        ${art?.code ? `<span class="rcpt-prod-code">${art.code}</span>` : ''}
        <div class="rcpt-prod-row2">${shelfBadge}
          <span class="rcpt-prod-colli">${colli}&nbsp;Colli</span>
          <span class="rcpt-prod-kg">${qtyKg.toFixed(1)}&nbsp;kg</span>
        </div>
        ${r3 ? `<div class="rcpt-prod-row3">${r3}</div>` : ''}
      </div>`;
    }).join('');

    const html = `<!doctype html><html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ricevuta #${orderId}</title>
<style>${THERMAL_CSS_SERVER}</style>
</head><body>
<img class="rcpt-logo" src="${logoUrl}" alt="${businessName}" onerror="this.style.display='none'">
<div class="rcpt-title">RITIRO</div>
<div class="rcpt-sub">${clientName}</div>
<div class="rcpt-info">
  <div class="rcpt-info-row"><span class="lbl">Data</span><span class="val">${fmtDate(dt)}</span></div>
  <div class="rcpt-info-row"><span class="lbl">Ora</span><span class="val">${fmtTime(dt)}</span></div>
  <div class="rcpt-info-row"><span class="lbl">Operatore</span><span class="val">${opName}</span></div>
  <div class="rcpt-info-row"><span class="lbl">Tipo</span><span class="val">Ordine Rapido</span></div>
</div>
<div class="rcpt-section">PRODOTTI</div>
${prodHtml}
<div class="rcpt-total">
  <span class="lbl">TOTALE</span>
  <span class="val">${totalColli} colli<br>${totalKg.toFixed(1)} kg</span>
</div>
<div class="rcpt-footer">Anteprima — ${fmtDate(dt)} ${fmtTime(dt)}</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).send('Errore: ' + err.message);
  }
});

// GET /api/printers/label-preview/:articleId — dati strutturati per anteprima etichetta
router.get('/label-preview/:articleId', authMiddleware, async (req: Request, res: Response) => {
  const articleId = parseInt(req.params.articleId);
  if (isNaN(articleId)) return res.status(400).json({ error: 'articleId non valido' });

  try {
    if (req.query.format === 'html') {
      const html = await buildTsplLabelPreviewHtml(
        articleId,
        typeof req.query.lot === 'string' ? req.query.lot : undefined,
        typeof req.query.expiry === 'string' ? req.query.expiry : undefined,
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: { nutritionalInfo: true },
    });
    if (!article) return res.status(404).json({ error: 'Articolo non trovato' });

    const settings = await prisma.companySettings.findMany({
      where: { key: { in: ['companyFullName', 'businessName'] } },
    });
    const companyName = settings.find(s => s.key === 'companyFullName')?.value
      || settings.find(s => s.key === 'businessName')?.value
      || 'Molino Briganti';

    res.json({
      companyName,
      name:           article.name,
      code:           article.code,
      category:       (article as any).category       ?? null,
      subcategory:    (article as any).subcategory    ?? null,
      productGroup:   (article as any).productGroup   ?? null,
      allergens:      (article as any).allergens      ?? null,
      barcode:        (article as any).barcode        ?? null,
      nutritionalInfo:(article as any).nutritionalInfo ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CRUD stampanti (solo master) ────────────────────────────────

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const printers = await prisma.printer.findMany({ orderBy: { id: 'asc' } });
    res.json(printers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user?.role !== 'master') return res.status(403).json({ error: 'Richiede ruolo master' });

  const { name, role, ip, port, protocol, active } = req.body;
  if (!name || !role || !ip || !protocol) {
    return res.status(400).json({ error: 'name, role, ip, protocol sono obbligatori' });
  }
  if (!['ESCPOS', 'TSPL'].includes(protocol)) {
    return res.status(400).json({ error: 'protocol deve essere ESCPOS o TSPL' });
  }
  // Validazione IP basica
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) {
    return res.status(400).json({ error: 'ip non valido' });
  }

  try {
    const printer = await prisma.printer.create({
      data: { name, role, ip, port: Number(port) || 9100, protocol, active: active !== false },
    });
    res.status(201).json(printer);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: `Ruolo "${role}" già in uso` });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user?.role !== 'master') return res.status(403).json({ error: 'Richiede ruolo master' });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'id non valido' });

  const { name, role, ip, port, protocol, active } = req.body;
  if (protocol && !['ESCPOS', 'TSPL'].includes(protocol)) {
    return res.status(400).json({ error: 'protocol deve essere ESCPOS o TSPL' });
  }

  try {
    const printer = await prisma.printer.update({
      where: { id },
      data: {
        ...(name     !== undefined && { name }),
        ...(role     !== undefined && { role }),
        ...(ip       !== undefined && { ip }),
        ...(port     !== undefined && { port: Number(port) }),
        ...(protocol !== undefined && { protocol }),
        ...(active   !== undefined && { active: Boolean(active) }),
      },
    });
    res.json(printer);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Stampante non trovata' });
    if (err.code === 'P2002') return res.status(409).json({ error: `Ruolo "${role}" già in uso` });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user?.role !== 'master') return res.status(403).json({ error: 'Richiede ruolo master' });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'id non valido' });

  try {
    await prisma.printer.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Stampante non trovata' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/printers/:id/test — stampa pagina di test
router.post('/:id/test', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user?.role !== 'master') return res.status(403).json({ error: 'Richiede ruolo master' });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'id non valido' });

  try {
    const printer = await prisma.printer.findUnique({ where: { id } });
    if (!printer) return res.status(404).json({ error: 'Stampante non trovata' });
    await executePrintJob({ role: printer.role, jobType: 'test' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Invio lavoro di stampa ───────────────────────────────────────

// POST /api/printers/job — invia un job di stampa
router.post('/job', authMiddleware, async (req: Request, res: Response) => {
  const job: PrintJobRequest = req.body;
  if (!job?.role || !job?.jobType) {
    return res.status(400).json({ error: 'role e jobType sono obbligatori' });
  }
  try {
    await executePrintJob(job);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/printers/html-preview — rasterizza HTML lato server (stesso motore usato per la stampa)
// per garantire che la preview mostrata all'utente sia pixel-identica a quanto verrà stampato
router.post('/html-preview', authMiddleware, async (req: Request, res: Response) => {
  const { contentHtml } = req.body as { contentHtml?: string };
  if (!contentHtml) return res.status(400).json({ error: 'contentHtml obbligatorio' });
  try {
    const pngDataUrl = await rasterizeHtmlToPng(contentHtml);
    res.json({ image: pngDataUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
