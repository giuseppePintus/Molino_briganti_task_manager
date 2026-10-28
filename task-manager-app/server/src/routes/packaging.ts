import { Router, Request, Response } from 'express';
import { authMiddleware, requireMaster } from '../middleware/auth';
import prisma from '../lib/prisma';
import { socketService, SocketEvents } from '../services/socketService';

const router = Router();

// Lettura per ogni utente autenticato, scrittura riservata al ruolo master
router.use(authMiddleware);
const master = [requireMaster];

function notifyChange(type: string, payload: any = {}) {
  try {
    socketService.broadcast(SocketEvents.PACKAGING_UPDATED, { type, ...payload });
  } catch (e) {
    console.error('❌ [PACKAGING] broadcast fallito:', e);
  }
}

function fail(res: Response, e: any, context: string) {
  console.error(`❌ [PACKAGING] ${context}:`, e);
  return res.status(500).json({ error: e?.message || 'Errore interno' });
}

const norm = (v: any) => (typeof v === 'string' ? v.trim() : '');
const toInt = (v: any, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};
const toFloatOrNull = (v: any) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const toIntOrNull = (v: any) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(parseFloat(String(v).replace(',', '.')));
  return Number.isFinite(n) ? n : null;
};

// ============================================
// COLORI
// ============================================
router.get('/colors', async (_req: Request, res: Response) => {
  try {
    const colors = await prisma.packagingColor.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    res.json(colors);
  } catch (e) { fail(res, e, 'GET /colors'); }
});

router.post('/colors', master, async (req: Request, res: Response) => {
  try {
    const name = norm(req.body?.name).toUpperCase();
    if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });
    const exists = await prisma.packagingColor.findUnique({ where: { name } });
    if (exists) return res.status(409).json({ error: `Colore "${name}" già presente` });
    const created = await prisma.packagingColor.create({
      data: { name, hex: norm(req.body?.hex) || null, sortOrder: toInt(req.body?.sortOrder) },
    });
    notifyChange('color');
    res.json(created);
  } catch (e) { fail(res, e, 'POST /colors'); }
});

router.put('/colors/:id', master, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id, -1);
    const name = norm(req.body?.name).toUpperCase();
    if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });
    const dup = await prisma.packagingColor.findFirst({ where: { name, NOT: { id } } });
    if (dup) return res.status(409).json({ error: `Colore "${name}" già presente` });
    const updated = await prisma.packagingColor.update({
      where: { id },
      data: { name, hex: norm(req.body?.hex) || null, sortOrder: toInt(req.body?.sortOrder) },
    });
    notifyChange('color');
    res.json(updated);
  } catch (e) { fail(res, e, 'PUT /colors/:id'); }
});

router.delete('/colors/:id', master, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id, -1);
    const used = await prisma.packagingItem.count({ where: { colorId: id } });
    if (used > 0 && req.query.force !== '1') {
      return res.status(409).json({ error: `Colore usato da ${used} imballaggi`, used });
    }
    await prisma.packagingColor.delete({ where: { id } });
    notifyChange('color');
    res.json({ success: true, cleared: used });
  } catch (e) { fail(res, e, 'DELETE /colors/:id'); }
});

// ============================================
// TIPOLOGIE (valvola manuale, automatica, termosaldabile, ...)
// ============================================
router.get('/types', async (_req: Request, res: Response) => {
  try {
    const types = await prisma.packagingType.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    res.json(types);
  } catch (e) { fail(res, e, 'GET /types'); }
});

router.post('/types', master, async (req: Request, res: Response) => {
  try {
    const name = norm(req.body?.name).toUpperCase();
    if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });
    const exists = await prisma.packagingType.findUnique({ where: { name } });
    if (exists) return res.status(409).json({ error: `Tipologia "${name}" già presente` });
    const created = await prisma.packagingType.create({ data: { name, sortOrder: toInt(req.body?.sortOrder) } });
    notifyChange('type');
    res.json(created);
  } catch (e) { fail(res, e, 'POST /types'); }
});

router.put('/types/:id', master, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id, -1);
    const name = norm(req.body?.name).toUpperCase();
    if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });
    const dup = await prisma.packagingType.findFirst({ where: { name, NOT: { id } } });
    if (dup) return res.status(409).json({ error: `Tipologia "${name}" già presente` });
    const updated = await prisma.packagingType.update({
      where: { id },
      data: { name, sortOrder: toInt(req.body?.sortOrder) },
    });
    notifyChange('type');
    res.json(updated);
  } catch (e) { fail(res, e, 'PUT /types/:id'); }
});

router.delete('/types/:id', master, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id, -1);
    const used = await prisma.packagingItemType.count({ where: { typeId: id } });
    if (used > 0 && req.query.force !== '1') {
      return res.status(409).json({ error: `Tipologia usata da ${used} imballaggi`, used });
    }
    await prisma.packagingType.delete({ where: { id } });
    notifyChange('type');
    res.json({ success: true, cleared: used });
  } catch (e) { fail(res, e, 'DELETE /types/:id'); }
});

// ============================================
// MISURE
// ============================================
function buildSizePayload(body: any) {
  const side1Mm = toIntOrNull(body?.side1Mm);
  const side2Mm = toIntOrNull(body?.side2Mm);
  const heightMm = toIntOrNull(body?.heightMm);
  if (side1Mm === null || side2Mm === null || heightMm === null) return null;
  const auto = `${side1Mm}x${side2Mm}x${heightMm}`;
  return {
    label: norm(body?.label) || auto,
    side1Mm,
    side2Mm,
    heightMm,
    capacityKg: toFloatOrNull(body?.capacityKg),
    sortOrder: toInt(body?.sortOrder),
  };
}

router.get('/sizes', async (_req: Request, res: Response) => {
  try {
    const sizes = await prisma.packagingSize.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
    res.json(sizes);
  } catch (e) { fail(res, e, 'GET /sizes'); }
});

router.post('/sizes', master, async (req: Request, res: Response) => {
  try {
    const data = buildSizePayload(req.body);
    if (!data) return res.status(400).json({ error: 'Lato 1, lato 2 e altezza (mm) sono obbligatori' });
    const exists = await prisma.packagingSize.findUnique({ where: { label: data.label } });
    if (exists) return res.status(409).json({ error: `Misura "${data.label}" già presente` });
    const created = await prisma.packagingSize.create({ data });
    notifyChange('size');
    res.json(created);
  } catch (e) { fail(res, e, 'POST /sizes'); }
});

router.put('/sizes/:id', master, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id, -1);
    const data = buildSizePayload(req.body);
    if (!data) return res.status(400).json({ error: 'Lato 1, lato 2 e altezza (mm) sono obbligatori' });
    const dup = await prisma.packagingSize.findFirst({ where: { label: data.label, NOT: { id } } });
    if (dup) return res.status(409).json({ error: `Misura "${data.label}" già presente` });
    const updated = await prisma.packagingSize.update({ where: { id }, data });
    notifyChange('size');
    res.json(updated);
  } catch (e) { fail(res, e, 'PUT /sizes/:id'); }
});

router.delete('/sizes/:id', master, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id, -1);
    const used = await prisma.packagingItem.count({ where: { sizeId: id } });
    if (used > 0 && req.query.force !== '1') {
      return res.status(409).json({ error: `Misura usata da ${used} imballaggi`, used });
    }
    await prisma.packagingSize.delete({ where: { id } });
    notifyChange('size');
    res.json({ success: true, cleared: used });
  } catch (e) { fail(res, e, 'DELETE /sizes/:id'); }
});

// ============================================
// POSIZIONI (dedicate al magazzino imballaggi)
// ============================================
router.get('/positions', async (_req: Request, res: Response) => {
  try {
    const positions = await prisma.packagingPosition.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
    res.json(positions);
  } catch (e) { fail(res, e, 'GET /positions'); }
});

router.post('/positions', master, async (req: Request, res: Response) => {
  try {
    const code = norm(req.body?.code).toUpperCase();
    if (!code) return res.status(400).json({ error: 'Codice obbligatorio' });
    const exists = await prisma.packagingPosition.findUnique({ where: { code } });
    if (exists) return res.status(409).json({ error: `Posizione "${code}" già presente` });
    const created = await prisma.packagingPosition.create({
      data: { code, description: norm(req.body?.description) || null, sortOrder: toInt(req.body?.sortOrder) },
    });
    notifyChange('position');
    res.json(created);
  } catch (e) { fail(res, e, 'POST /positions'); }
});

router.put('/positions/:id', master, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id, -1);
    const current = await prisma.packagingPosition.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Posizione non trovata' });
    const code = norm(req.body?.code).toUpperCase();
    if (!code) return res.status(400).json({ error: 'Codice obbligatorio' });
    const dup = await prisma.packagingPosition.findFirst({ where: { code, NOT: { id } } });
    if (dup) return res.status(409).json({ error: `Posizione "${code}" già presente` });

    const updated = await prisma.$transaction(async (tx) => {
      const pos = await tx.packagingPosition.update({
        where: { id },
        data: {
          code,
          description: norm(req.body?.description) || null,
          isActive: req.body?.isActive !== false,
          sortOrder: toInt(req.body?.sortOrder),
        },
      });
      // Le giacenze referenziano il codice, non l'id: va propagato
      if (current.code !== code) {
        await tx.packagingEntry.updateMany({ where: { positionCode: current.code }, data: { positionCode: code } });
        await tx.packagingMovement.updateMany({ where: { positionCode: current.code }, data: { positionCode: code } });
      }
      return pos;
    });
    notifyChange('position');
    res.json(updated);
  } catch (e) { fail(res, e, 'PUT /positions/:id'); }
});

router.delete('/positions/:id', master, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id, -1);
    const current = await prisma.packagingPosition.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Posizione non trovata' });
    const used = await prisma.packagingEntry.count({ where: { positionCode: current.code, quantity: { gt: 0 } } });
    if (used > 0 && req.query.force !== '1') {
      return res.status(409).json({ error: `Posizione con giacenza su ${used} imballaggi`, used });
    }
    await prisma.$transaction(async (tx) => {
      await tx.packagingEntry.deleteMany({ where: { positionCode: current.code } });
      await tx.packagingPosition.delete({ where: { id } });
    });
    notifyChange('position');
    res.json({ success: true, cleared: used });
  } catch (e) { fail(res, e, 'DELETE /positions/:id'); }
});

// ============================================
// IMBALLAGGI
// ============================================
const ITEM_INCLUDE = {
  color: true,
  size: true,
  types: { include: { type: true } },
  entries: { orderBy: { positionCode: 'asc' as const } },
};

function decorateItem(item: any) {
  const totalQuantity = (item.entries || []).reduce((sum: number, e: any) => sum + (e.quantity || 0), 0);
  return {
    ...item,
    typeIds: (item.types || []).map((t: any) => t.typeId),
    typeNames: (item.types || []).map((t: any) => t.type?.name).filter(Boolean),
    totalQuantity,
    lowStock: item.minimumStock > 0 && totalQuantity < item.minimumStock,
  };
}

// Il codice deve essere univoco tra gli imballaggi e non collidere con i codici articolo
async function findCodeConflict(code: string, excludeId?: number) {
  const item = await prisma.packagingItem.findFirst({
    where: excludeId ? { code, NOT: { id: excludeId } } : { code },
  });
  if (item) return `Codice "${code}" già usato da un altro imballaggio`;
  const article = await prisma.article.findFirst({ where: { code } });
  if (article) return `Codice "${code}" già usato dall'articolo "${article.name}"`;
  return null;
}

router.get('/items', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.packagingItem.findMany({
      include: ITEM_INCLUDE,
      orderBy: { code: 'asc' },
    });
    res.json(items.map(decorateItem));
  } catch (e) { fail(res, e, 'GET /items'); }
});

router.get('/items/check-code', async (req: Request, res: Response) => {
  try {
    const code = norm(req.query.code).toUpperCase();
    if (!code) return res.json({ available: false, error: 'Codice obbligatorio' });
    const excludeId = req.query.excludeId ? toInt(req.query.excludeId, 0) : undefined;
    const conflict = await findCodeConflict(code, excludeId || undefined);
    res.json({ available: !conflict, error: conflict });
  } catch (e) { fail(res, e, 'GET /items/check-code'); }
});

router.get('/items/:id', async (req: Request, res: Response) => {
  try {
    const item = await prisma.packagingItem.findUnique({
      where: { id: toInt(req.params.id, -1) },
      include: ITEM_INCLUDE,
    });
    if (!item) return res.status(404).json({ error: 'Imballaggio non trovato' });
    res.json(decorateItem(item));
  } catch (e) { fail(res, e, 'GET /items/:id'); }
});

router.post('/items', master, async (req: Request, res: Response) => {
  try {
    const code = norm(req.body?.code).toUpperCase();
    const description = norm(req.body?.description);
    if (!code) return res.status(400).json({ error: 'Codice obbligatorio' });
    if (!description) return res.status(400).json({ error: 'Descrizione obbligatoria' });

    const conflict = await findCodeConflict(code);
    if (conflict) return res.status(409).json({ error: conflict });

    const typeIds: number[] = Array.isArray(req.body?.typeIds) ? req.body.typeIds.map((t: any) => toInt(t, 0)).filter(Boolean) : [];
    const initialQty = toInt(req.body?.initialQuantity);
    const initialPos = norm(req.body?.initialPositionCode).toUpperCase();

    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.packagingItem.create({
        data: {
          code,
          description,
          colorId: req.body?.colorId ? toInt(req.body.colorId) : null,
          sizeId: req.body?.sizeId ? toInt(req.body.sizeId) : null,
          minimumStock: toInt(req.body?.minimumStock),
          notes: norm(req.body?.notes) || null,
        },
      });
      if (typeIds.length) {
        await tx.packagingItemType.createMany({ data: typeIds.map((typeId) => ({ itemId: item.id, typeId })) });
      }
      if (initialPos && initialQty > 0) {
        await tx.packagingEntry.create({ data: { itemId: item.id, positionCode: initialPos, quantity: initialQty } });
        await tx.packagingMovement.create({
          data: {
            itemId: item.id,
            positionCode: initialPos,
            type: 'IN',
            quantity: initialQty,
            reason: 'Giacenza iniziale',
            createdBy: req.user?.username || null,
          },
        });
      }
      return tx.packagingItem.findUnique({ where: { id: item.id }, include: ITEM_INCLUDE });
    });

    notifyChange('item', { itemId: created?.id });
    res.json(decorateItem(created));
  } catch (e) { fail(res, e, 'POST /items'); }
});

router.put('/items/:id', master, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id, -1);
    const code = norm(req.body?.code).toUpperCase();
    const description = norm(req.body?.description);
    if (!code) return res.status(400).json({ error: 'Codice obbligatorio' });
    if (!description) return res.status(400).json({ error: 'Descrizione obbligatoria' });

    const conflict = await findCodeConflict(code, id);
    if (conflict) return res.status(409).json({ error: conflict });

    const typeIds: number[] = Array.isArray(req.body?.typeIds) ? req.body.typeIds.map((t: any) => toInt(t, 0)).filter(Boolean) : [];

    const updated = await prisma.$transaction(async (tx) => {
      await tx.packagingItem.update({
        where: { id },
        data: {
          code,
          description,
          colorId: req.body?.colorId ? toInt(req.body.colorId) : null,
          sizeId: req.body?.sizeId ? toInt(req.body.sizeId) : null,
          minimumStock: toInt(req.body?.minimumStock),
          isActive: req.body?.isActive !== false,
          notes: norm(req.body?.notes) || null,
        },
      });
      await tx.packagingItemType.deleteMany({ where: { itemId: id } });
      if (typeIds.length) {
        await tx.packagingItemType.createMany({ data: typeIds.map((typeId) => ({ itemId: id, typeId })) });
      }
      return tx.packagingItem.findUnique({ where: { id }, include: ITEM_INCLUDE });
    });

    notifyChange('item', { itemId: id });
    res.json(decorateItem(updated));
  } catch (e) { fail(res, e, 'PUT /items/:id'); }
});

router.delete('/items/:id', master, async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id, -1);
    const stocked = await prisma.packagingEntry.aggregate({ where: { itemId: id }, _sum: { quantity: true } });
    const total = stocked._sum.quantity || 0;
    if (total > 0 && req.query.force !== '1') {
      return res.status(409).json({ error: `Imballaggio con giacenza di ${total} pezzi`, total });
    }
    await prisma.packagingItem.delete({ where: { id } });
    notifyChange('item', { itemId: id });
    res.json({ success: true });
  } catch (e) { fail(res, e, 'DELETE /items/:id'); }
});

// ============================================
// GIACENZE E MOVIMENTI
// ============================================
router.post('/stock/move', master, async (req: Request, res: Response) => {
  try {
    const itemId = toInt(req.body?.itemId, -1);
    const positionCode = norm(req.body?.positionCode).toUpperCase();
    const type = norm(req.body?.type).toUpperCase();
    const quantity = toInt(req.body?.quantity);

    if (itemId < 0) return res.status(400).json({ error: 'Imballaggio obbligatorio' });
    if (!positionCode) return res.status(400).json({ error: 'Posizione obbligatoria' });
    if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type)) return res.status(400).json({ error: 'Tipo movimento non valido' });
    if (quantity < 0) return res.status(400).json({ error: 'Quantità non valida' });
    if (type !== 'ADJUSTMENT' && quantity === 0) return res.status(400).json({ error: 'Quantità non valida' });

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.packagingItem.findUnique({ where: { id: itemId } });
      if (!item) throw new Error('Imballaggio non trovato');
      const position = await tx.packagingPosition.findUnique({ where: { code: positionCode } });
      if (!position) throw new Error(`Posizione "${positionCode}" inesistente`);

      const entry = await tx.packagingEntry.findUnique({ where: { itemId_positionCode: { itemId, positionCode } } });
      const current = entry?.quantity || 0;
      let next = current;
      if (type === 'IN') next = current + quantity;
      else if (type === 'OUT') next = current - quantity;
      else next = quantity;

      if (next < 0) throw new Error(`Giacenza insufficiente: disponibili ${current} pezzi in ${positionCode}`);

      const saved = entry
        ? await tx.packagingEntry.update({ where: { id: entry.id }, data: { quantity: next } })
        : await tx.packagingEntry.create({ data: { itemId, positionCode, quantity: next } });

      await tx.packagingMovement.create({
        data: {
          itemId,
          positionCode,
          type,
          quantity: type === 'ADJUSTMENT' ? next - current : quantity,
          reason: norm(req.body?.reason) || null,
          createdBy: req.user?.username || null,
        },
      });

      return saved;
    });

    notifyChange('stock', { itemId });
    res.json(result);
  } catch (e: any) {
    const msg = e?.message || '';
    if (msg.includes('insufficiente') || msg.includes('inesistente') || msg.includes('non trovato')) {
      return res.status(400).json({ error: msg });
    }
    fail(res, e, 'POST /stock/move');
  }
});

router.get('/movements', async (req: Request, res: Response) => {
  try {
    const itemId = req.query.itemId ? toInt(req.query.itemId, -1) : undefined;
    const limit = Math.min(toInt(req.query.limit, 100), 500);
    const movements = await prisma.packagingMovement.findMany({
      where: itemId !== undefined ? { itemId } : undefined,
      include: { item: { select: { code: true, description: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(movements);
  } catch (e) { fail(res, e, 'GET /movements'); }
});

router.get('/alerts', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.packagingItem.findMany({
      where: { isActive: true, minimumStock: { gt: 0 } },
      include: ITEM_INCLUDE,
      orderBy: { code: 'asc' },
    });
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const shortages = await prisma.packagingMovement.findMany({
      where: { shortage: { gt: 0 }, createdAt: { gte: since } },
      include: { item: { select: { code: true, description: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ lowStock: items.map(decorateItem).filter((i) => i.lowStock), shortages });
  } catch (e) { fail(res, e, 'GET /alerts'); }
});

// ============================================
// ASSOCIAZIONE ARTICOLI ↔ IMBALLAGGI
// ============================================
router.get('/article-links', async (_req: Request, res: Response) => {
  try {
    const links = await prisma.articlePackaging.findMany({
      include: { item: { select: { code: true, description: true } } },
      orderBy: { articleId: 'asc' },
    });
    const map: Record<number, any[]> = {};
    for (const l of links) {
      (map[l.articleId] ||= []).push({
        packagingItemId: l.packagingItemId,
        code: l.item.code,
        description: l.item.description,
        role: l.role,
        colliPerUnit: l.colliPerUnit,
      });
    }
    res.json(map);
  } catch (e) { fail(res, e, 'GET /article-links'); }
});

router.get('/articles/:articleId', async (req: Request, res: Response) => {
  try {
    const links = await prisma.articlePackaging.findMany({
      where: { articleId: toInt(req.params.articleId, -1) },
      include: { item: true },
      orderBy: { role: 'asc' },
    });
    res.json(links);
  } catch (e) { fail(res, e, 'GET /articles/:articleId'); }
});

router.put('/articles/:articleId', master, async (req: Request, res: Response) => {
  try {
    const articleId = toInt(req.params.articleId, -1);
    const article = await prisma.article.findUnique({ where: { id: articleId } });
    if (!article) return res.status(404).json({ error: 'Articolo non trovato' });

    const incoming: any[] = Array.isArray(req.body?.packagings) ? req.body.packagings : [];
    const data = incoming
      .map((p) => ({
        articleId,
        packagingItemId: toInt(p?.packagingItemId, 0),
        role: norm(p?.role).toUpperCase() === 'CONTAINER' ? 'CONTAINER' : 'PRIMARY',
        colliPerUnit: Math.max(1, toInt(p?.colliPerUnit, 1)),
      }))
      .filter((p) => p.packagingItemId > 0);

    await prisma.$transaction(async (tx) => {
      await tx.articlePackaging.deleteMany({ where: { articleId } });
      if (data.length) await tx.articlePackaging.createMany({ data });
    });

    const links = await prisma.articlePackaging.findMany({ where: { articleId }, include: { item: true } });
    notifyChange('article-links', { articleId });
    res.json(links);
  } catch (e) { fail(res, e, 'PUT /articles/:articleId'); }
});

export default router;
