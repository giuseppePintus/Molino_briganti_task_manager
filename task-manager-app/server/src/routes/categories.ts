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
    const newNames = items.map(it => it.name);
    // Elimina solo le categorie rimosse dalla lista (la cascade sulle sub è voluta per le cat eliminate)
    await tx.productCategory.deleteMany({ where: { name: { notIn: newNames } } });
    // Upsert: mantiene l'id esistente → le sotto-categorie collegate non vengono perse
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await tx.productCategory.upsert({
        where: { name: it.name },
        update: { icon: it.icon ?? null, color: it.color ?? null, sortOrder: i },
        create: { name: it.name, icon: it.icon ?? null, color: it.color ?? null, sortOrder: i }
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

// GET pubblico - sottocategorie di una categoria (definite in Gestione Categorie)
router.get('/:name/subcategories', async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name || '').trim().toUpperCase();
    if (!name) return res.json([]);
    const cat = await prisma.productCategory.findUnique({ where: { name } });
    if (!cat) return res.json([]);
    const rows = await prisma.productSubcategory.findMany({
      where: { categoryId: cat.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { name: true },
    });
    return res.json(rows.map(r => r.name));
  } catch (e: any) {
    console.error('[categories] GET subcategories error', e);
    return res.status(500).json({ error: e.message });
  }
});

// Helper: assicura che la categoria esista in DB e ne ritorna l'id
async function ensureCategoryId(name: string): Promise<number> {
  const existing = await prisma.productCategory.findUnique({ where: { name } });
  if (existing) return existing.id;
  const last = await prisma.productCategory.findFirst({ orderBy: { sortOrder: 'desc' } });
  const created = await prisma.productCategory.create({
    data: { name, sortOrder: (last?.sortOrder ?? -1) + 1 }
  });
  return created.id;
}

async function findSubcategory(categoryName: string, subcategoryName: string) {
  const cat = await prisma.productCategory.findUnique({ where: { name: categoryName } });
  if (!cat) return null;
  return prisma.productSubcategory.findFirst({
    where: { categoryId: cat.id, name: subcategoryName }
  });
}

async function ensureSubcategoryId(categoryName: string, subcategoryName: string): Promise<number> {
  const categoryId = await ensureCategoryId(categoryName);
  const existing = await prisma.productSubcategory.findFirst({
    where: { categoryId, name: subcategoryName }
  });
  if (existing) return existing.id;
  const last = await prisma.productSubcategory.findFirst({
    where: { categoryId },
    orderBy: { sortOrder: 'desc' }
  });
  const created = await prisma.productSubcategory.create({
    data: { categoryId, name: subcategoryName, sortOrder: (last?.sortOrder ?? -1) + 1 }
  });
  return created.id;
}

router.get('/:name/subcategories/:sub/groups', async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name || '').trim().toUpperCase();
    const sub = String(req.params.sub || '').trim().toUpperCase();
    if (!name || !sub) return res.json([]);
    const subcategory = await findSubcategory(name, sub);
    if (!subcategory) return res.json([]);
    const rows = await prisma.productGroup.findMany({
      where: { subcategoryId: subcategory.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { name: true },
    });
    return res.json(rows.map(r => r.name));
  } catch (e: any) {
    console.error('[categories] GET groups error', e);
    return res.status(500).json({ error: e.message });
  }
});

// POST - aggiunge una sotto-categoria a una categoria
router.post('/:name/subcategories', authMiddleware, async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name || '').trim().toUpperCase();
    const subRaw = (req.body?.name ?? '').toString().trim();
    if (!name) return res.status(400).json({ error: 'Categoria obbligatoria' });
    if (!subRaw) return res.status(400).json({ error: 'Nome sotto-categoria obbligatorio' });
    if (/["'`]/.test(subRaw)) return res.status(400).json({ error: 'Il nome non può contenere virgolette (", \', `)' });
    const sub = subRaw.toUpperCase();
    const categoryId = await ensureCategoryId(name);
    const last = await prisma.productSubcategory.findFirst({
      where: { categoryId },
      orderBy: { sortOrder: 'desc' }
    });
    try {
      const created = await prisma.productSubcategory.create({
        data: { categoryId, name: sub, sortOrder: (last?.sortOrder ?? -1) + 1 }
      });
      return res.json({ ok: true, id: created.id, name: created.name });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return res.status(409).json({ error: `Sotto-categoria "${sub}" già esistente` });
      }
      throw e;
    }
  } catch (e: any) {
    console.error('[categories] POST subcategory error', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/:name/subcategories/rename', authMiddleware, async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name || '').trim().toUpperCase();
    const fromRaw = (req.body?.from ?? '').toString().trim();
    const toRaw = (req.body?.to ?? '').toString().trim();
    if (!name) return res.status(400).json({ error: 'Categoria obbligatoria' });
    if (!fromRaw || !toRaw) return res.status(400).json({ error: 'Parametri "from" e "to" obbligatori' });
    if (/["'`]/.test(toRaw)) return res.status(400).json({ error: 'Il nome non può contenere virgolette (", \' , `)' });

    const from = fromRaw.toUpperCase();
    const to = toRaw.toUpperCase();
    if (from === to) return res.json({ ok: true, articlesUpdated: 0 });

    const cat = await prisma.productCategory.findUnique({ where: { name } });
    if (!cat) return res.status(404).json({ error: `Categoria "${name}" non trovata` });

    const source = await prisma.productSubcategory.findFirst({ where: { categoryId: cat.id, name: from } });
    if (!source) return res.status(404).json({ error: `Sotto-categoria "${from}" non trovata` });

    const existing = await prisma.productSubcategory.findFirst({ where: { categoryId: cat.id, name: to } });
    if (existing) return res.status(409).json({ error: `Sotto-categoria "${to}" già esistente` });

    await prisma.productSubcategory.update({ where: { id: source.id }, data: { name: to } });
    const updated = await prisma.article.updateMany({
      where: { category: name, subcategory: from },
      data: { subcategory: to }
    });

    return res.json({ ok: true, articlesUpdated: updated.count });
  } catch (e: any) {
    console.error('[categories] RENAME subcategory error', e);
    return res.status(500).json({ error: e.message });
  }
});

router.post('/:name/subcategories/:sub/groups', authMiddleware, async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name || '').trim().toUpperCase();
    const sub = String(req.params.sub || '').trim().toUpperCase();
    const groupRaw = (req.body?.name ?? '').toString().trim();
    if (!name) return res.status(400).json({ error: 'Categoria obbligatoria' });
    if (!sub) return res.status(400).json({ error: 'Sotto-categoria obbligatoria' });
    if (!groupRaw) return res.status(400).json({ error: 'Nome gruppo obbligatorio' });
    if (/['"`]/.test(groupRaw)) return res.status(400).json({ error: 'Il nome non può contenere virgolette (", \' , `)' });
    const group = groupRaw.toUpperCase();
    const subcategoryId = await ensureSubcategoryId(name, sub);
    const last = await prisma.productGroup.findFirst({
      where: { subcategoryId },
      orderBy: { sortOrder: 'desc' }
    });
    try {
      const created = await prisma.productGroup.create({
        data: { subcategoryId, name: group, sortOrder: (last?.sortOrder ?? -1) + 1 }
      });
      return res.json({ ok: true, id: created.id, name: created.name });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return res.status(409).json({ error: `Gruppo "${group}" già esistente` });
      }
      throw e;
    }
  } catch (e: any) {
    console.error('[categories] POST group error', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/:name/subcategories/:sub/groups/rename', authMiddleware, async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name || '').trim().toUpperCase();
    const sub = String(req.params.sub || '').trim().toUpperCase();
    const fromRaw = (req.body?.from ?? '').toString().trim();
    const toRaw = (req.body?.to ?? '').toString().trim();
    if (!name || !sub) return res.status(400).json({ error: 'Categoria e sotto-categoria obbligatorie' });
    if (!fromRaw || !toRaw) return res.status(400).json({ error: 'Parametri "from" e "to" obbligatori' });
    if (/["'`]/.test(toRaw)) return res.status(400).json({ error: 'Il nome non può contenere virgolette (", \' , `)' });

    const from = fromRaw.toUpperCase();
    const to = toRaw.toUpperCase();
    if (from === to) return res.json({ ok: true, articlesUpdated: 0 });

    const subcategory = await findSubcategory(name, sub);
    if (!subcategory) return res.status(404).json({ error: `Sotto-categoria "${sub}" non trovata` });

    const source = await prisma.productGroup.findFirst({ where: { subcategoryId: subcategory.id, name: from } });
    if (!source) return res.status(404).json({ error: `Gruppo "${from}" non trovato` });

    const existing = await prisma.productGroup.findFirst({ where: { subcategoryId: subcategory.id, name: to } });
    if (existing) return res.status(409).json({ error: `Gruppo "${to}" già esistente` });

    await prisma.productGroup.update({ where: { id: source.id }, data: { name: to } });
    const updated = await prisma.article.updateMany({
      where: { category: name, subcategory: sub, productGroup: from },
      data: { productGroup: to }
    });

    return res.json({ ok: true, articlesUpdated: updated.count });
  } catch (e: any) {
    console.error('[categories] RENAME group error', e);
    return res.status(500).json({ error: e.message });
  }
});

// DELETE - rimuove una sotto-categoria
router.delete('/:name/subcategories/:sub', authMiddleware, async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name || '').trim().toUpperCase();
    const sub = String(req.params.sub || '').trim().toUpperCase();
    if (!name || !sub) return res.status(400).json({ error: 'Parametri mancanti' });
    const cat = await prisma.productCategory.findUnique({ where: { name } });
    if (!cat) return res.json({ ok: true, deleted: 0 });
    // Conta articoli che usano questa sub
    const inUse = await prisma.article.count({ where: { category: name, subcategory: sub } });
    if (inUse > 0 && req.query.force !== '1') {
      return res.status(409).json({ error: `Sotto-categoria usata da ${inUse} articoli`, inUse });
    }
    await prisma.productSubcategory.deleteMany({ where: { categoryId: cat.id, name: sub } });
    if (req.query.force === '1' && inUse > 0) {
      // svuota subcategory degli articoli interessati
      await prisma.article.updateMany({
        where: { category: name, subcategory: sub },
        data: { subcategory: null, productGroup: null }
      });
    }
    return res.json({ ok: true, clearedArticles: req.query.force === '1' ? inUse : 0 });
  } catch (e: any) {
    console.error('[categories] DELETE subcategory error', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:name/subcategories/:sub/groups/:group', authMiddleware, async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name || '').trim().toUpperCase();
    const sub = String(req.params.sub || '').trim().toUpperCase();
    const group = String(req.params.group || '').trim().toUpperCase();
    if (!name || !sub || !group) return res.status(400).json({ error: 'Parametri mancanti' });
    const subcategory = await findSubcategory(name, sub);
    if (!subcategory) return res.json({ ok: true, deleted: 0 });
    const inUse = await prisma.article.count({ where: { category: name, subcategory: sub, productGroup: group } });
    if (inUse > 0 && req.query.force !== '1') {
      return res.status(409).json({ error: `Gruppo usato da ${inUse} articoli`, inUse });
    }
    await prisma.productGroup.deleteMany({ where: { subcategoryId: subcategory.id, name: group } });
    if (req.query.force === '1' && inUse > 0) {
      await prisma.article.updateMany({
        where: { category: name, subcategory: sub, productGroup: group },
        data: { productGroup: null }
      });
    }
    return res.json({ ok: true, clearedArticles: req.query.force === '1' ? inUse : 0 });
  } catch (e: any) {
    console.error('[categories] DELETE group error', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT - sostituisce intera lista sotto-categorie di una categoria (riordino/rinomina batch)
router.put('/:name/subcategories', authMiddleware, async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name || '').trim().toUpperCase();
    const items = req.body;
    if (!name) return res.status(400).json({ error: 'Categoria obbligatoria' });
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Body deve essere un array' });
    const sanitized = items
      .map(it => (typeof it === 'string' ? it : it?.name))
      .map(s => (s || '').toString().trim().toUpperCase())
      .filter(s => s.length > 0);
    const categoryId = await ensureCategoryId(name);
    await prisma.$transaction(async (tx) => {
      await tx.article.updateMany({
        where: {
          category: name,
          subcategory: sanitized.length > 0 ? { notIn: sanitized } : { not: null }
        },
        data: { subcategory: null, productGroup: null }
      });
      await tx.productSubcategory.deleteMany({ where: { categoryId } });
      for (let i = 0; i < sanitized.length; i++) {
        await tx.productSubcategory.create({
          data: { categoryId, name: sanitized[i], sortOrder: i }
        });
      }
    });
    return res.json({ ok: true, count: sanitized.length });
  } catch (e: any) {
    console.error('[categories] PUT subcategories error', e);
    res.status(500).json({ error: e.message });
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
    const forceRaw = String((req.query.force ?? req.body?.force ?? '')).toLowerCase();
    const force = forceRaw === '1' || forceRaw === 'true' || forceRaw === 'yes';
    const inUse = await prisma.article.count({ where: { category: name } });
    if (inUse > 0 && !force) {
      return res.status(409).json({ error: `Categoria usata da ${inUse} articoli` });
    }
    if (inUse > 0 && force) {
      await prisma.article.updateMany({
        where: { category: name },
        data: { category: null, subcategory: null, productGroup: null }
      });
    }
    await prisma.productCategory.deleteMany({ where: { name } });
    res.json({ ok: true, articlesUpdated: force ? inUse : 0 });
  } catch (e: any) {
    console.error('[categories] delete error', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
