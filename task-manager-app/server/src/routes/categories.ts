import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Categorie predefinite (allineate al frontend warehouse-management.html)
export const DEFAULT_CATEGORIES = [
  { name: 'FARINE',          icon: '🌾', color: '#f59e0b' },
  { name: 'MIX FARINE',      icon: '🥣', color: '#d97706' },
  { name: 'SEMOLE',          icon: '🌽', color: '#84cc16' },
  { name: 'CEREALI',         icon: '🌿', color: '#10b981' },
  { name: 'CEREALI PERLATI', icon: '💎', color: '#06b6d4' },
  { name: 'MANGIMI',         icon: '🐄', color: '#8b5cf6' },
  { name: 'ALTRO',           icon: '📦', color: '#6b7280' }
];

interface CategoryItem {
  name: string;
  icon?: string | null;
  color?: string | null;
}

async function loadCategoriesDb(): Promise<CategoryItem[]> {
  const rows = await prisma.productCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  });
  return rows.map(r => ({ name: r.name, icon: r.icon, color: r.color }));
}

async function saveCategoriesDb(items: CategoryItem[]): Promise<void> {
  // Sostituisce intera lista preservando l'ordine: usa una transazione
  await prisma.$transaction(async (tx) => {
    await tx.productCategory.deleteMany({});
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await tx.productCategory.create({
        data: {
          name: it.name,
          icon: it.icon ?? null,
          color: it.color ?? null,
          sortOrder: i
        }
      });
    }
  });
}

// GET pubblico - lista ordinata
router.get('/', async (_req: Request, res: Response) => {
  try {
    const cats = await loadCategoriesDb();
    if (cats.length > 0) {
      return res.json(cats);
    }
    // DB vuoto → deriva dalle categorie realmente presenti sugli articoli + default
    const rows = await prisma.article.findMany({
      select: { category: true },
      where: { category: { not: null } }
    });
    const realCats = Array.from(new Set(
      rows
        .map(r => (r.category || '').trim().toUpperCase())
        .filter(c => c.length > 0)
    )).sort();
    const defMap = new Map(DEFAULT_CATEGORIES.map(c => [c.name, c]));
    const merged: CategoryItem[] = realCats.map(name =>
      defMap.get(name) ? { ...defMap.get(name)! } : { name }
    );
    for (const d of DEFAULT_CATEGORIES) {
      if (!merged.some(m => m.name === d.name)) merged.push({ ...d });
    }
    return res.json(merged);
  } catch (e: any) {
    console.error('[categories] GET error', e);
    return res.status(500).json({ error: e.message });
  }
});

// PUT - sostituisce intera lista (riordino, icone, colori)
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Body deve essere un array di categorie' });
    }
    const sanitized: CategoryItem[] = items
      .filter(it => it && typeof it.name === 'string' && it.name.trim())
      .map(it => ({
        name: String(it.name).trim().toUpperCase(),
        icon: typeof it.icon === 'string' ? it.icon : null,
        color: typeof it.color === 'string' ? it.color : null
      }));
    await saveCategoriesDb(sanitized);
    res.json({ ok: true, count: sanitized.length });
  } catch (e: any) {
    console.error('[categories] PUT error', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /rename - rinomina e propaga su tutti gli articoli
router.post('/rename', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.body || {};
    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      return res.status(400).json({ error: 'Parametri "from" e "to" obbligatori' });
    }
    const oldName = from.trim().toUpperCase();
    const newName = to.trim().toUpperCase();
    if (!oldName || !newName) return res.status(400).json({ error: 'Nomi non validi' });

    // Aggiorna articoli sul DB
    let updated = 0;
    try {
      const result = await prisma.article.updateMany({
        where: { category: oldName },
        data: { category: newName }
      });
      updated = result.count;
    } catch (e) {
      console.error('[categories/rename] updateMany error', e);
    }

    // Aggiorna categoria in DB (se esiste)
    try {
      await prisma.productCategory.update({
        where: { name: oldName },
        data: { name: newName }
      });
    } catch (e) {
      // Se non esiste, la creiamo
      try {
        const last = await prisma.productCategory.findFirst({ orderBy: { sortOrder: 'desc' } });
        await prisma.productCategory.create({
          data: { name: newName, sortOrder: (last?.sortOrder ?? -1) + 1 }
        });
      } catch (_) { /* ignore */ }
    }

    res.json({ ok: true, articlesUpdated: updated });
  } catch (e: any) {
    console.error('[categories] rename error', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:name - rimuove categoria (se non in uso)
router.delete('/:name', authMiddleware, async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name || '').trim().toUpperCase();
    if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });
    const inUse = await prisma.article.count({ where: { category: name } });
    if (inUse > 0) {
      return res.status(409).json({ error: `Categoria usata da ${inUse} articoli` });
    }
    await prisma.productCategory.deleteMany({ where: { name } });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[categories] delete error', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
