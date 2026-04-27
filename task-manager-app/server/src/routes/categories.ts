import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Categorie predefinite (allineate al frontend warehouse-management.html)
const DEFAULT_CATEGORIES = [
  { name: 'FARINE',          icon: '🌾', color: '#f59e0b' },
  { name: 'MIX FARINE',      icon: '🥣', color: '#d97706' },
  { name: 'SEMOLE',          icon: '🌽', color: '#84cc16' },
  { name: 'CEREALI',         icon: '🌿', color: '#10b981' },
  { name: 'CEREALI PERLATI', icon: '💎', color: '#06b6d4' },
  { name: 'MANGIMI',         icon: '🐄', color: '#8b5cf6' },
  { name: 'ALTRO',           icon: '📦', color: '#6b7280' }
];

// Percorso file persistente
const STORAGE_PATHS = [
  process.env.CATEGORIES_JSON_PATH,
  '/data/molino/categories.json',
  '/share/Container/data/molino/categories.json',
  path.join(process.cwd(), 'data', 'categories.json')
].filter(Boolean) as string[];

function getStoragePath(): string {
  // Restituisce il primo path la cui dir esiste (o usabile)
  for (const p of STORAGE_PATHS) {
    try {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) return p;
    } catch (_) { /* ignore */ }
  }
  // Fallback: crea local
  const fallback = path.join(process.cwd(), 'data', 'categories.json');
  try { fs.mkdirSync(path.dirname(fallback), { recursive: true }); } catch (_) {}
  return fallback;
}

interface CategoryItem {
  name: string;
  icon?: string;
  color?: string;
}

function loadCategories(): CategoryItem[] {
  const file = getStoragePath();
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as CategoryItem[];
    }
  } catch (e) {
    console.error('[categories] errore lettura', e);
  }
  return DEFAULT_CATEGORIES.map(c => ({ ...c }));
}

function saveCategories(items: CategoryItem[]): void {
  const file = getStoragePath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf-8');
  } catch (e) {
    console.error('[categories] errore scrittura', e);
    throw e;
  }
}

// GET pubblico - lista ordinata
router.get('/', async (_req: Request, res: Response) => {
  const file = getStoragePath();
  // Se l'utente ha già personalizzato (file esiste) → restituisci la sua lista così com'è
  if (fs.existsSync(file)) {
    return res.json(loadCategories());
  }
  // Altrimenti deriva dalle categorie realmente presenti sugli articoli + default
  try {
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
    // Aggiungi default mancanti (in coda) per non perdere icone/colori delle categorie standard
    for (const d of DEFAULT_CATEGORIES) {
      if (!merged.some(m => m.name === d.name)) merged.push({ ...d });
    }
    return res.json(merged);
  } catch (e) {
    console.error('[categories] GET fallback error', e);
    return res.json(loadCategories());
  }
});

// PUT - sostituisce intera lista (riordino, icone, colori)
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  const items = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Body deve essere un array di categorie' });
  }
  const sanitized: CategoryItem[] = items
    .filter(it => it && typeof it.name === 'string' && it.name.trim())
    .map(it => ({
      name: String(it.name).trim().toUpperCase(),
      icon: typeof it.icon === 'string' ? it.icon : undefined,
      color: typeof it.color === 'string' ? it.color : undefined
    }));
  saveCategories(sanitized);
  res.json({ ok: true, count: sanitized.length });
});

// POST /rename - rinomina e propaga su tutti gli articoli
router.post('/rename', authMiddleware, async (req: Request, res: Response) => {
  const { from, to } = req.body || {};
  if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
    return res.status(400).json({ error: 'Parametri "from" e "to" obbligatori' });
  }
  const oldName = from.trim().toUpperCase();
  const newName = to.trim().toUpperCase();
  if (!oldName || !newName) return res.status(400).json({ error: 'Nomi non validi' });

  // Aggiorna articoli sul DB (case-insensitive su MariaDB)
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

  // Aggiorna lista
  const items = loadCategories();
  const idx = items.findIndex(c => c.name.toUpperCase() === oldName);
  if (idx >= 0) {
    items[idx] = { ...items[idx], name: newName };
    saveCategories(items);
  }

  res.json({ ok: true, articlesUpdated: updated });
});

// DELETE /:name - rimuove categoria (se non in uso)
router.delete('/:name', authMiddleware, async (req: Request, res: Response) => {
  const name = String(req.params.name || '').trim().toUpperCase();
  if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });
  const inUse = await prisma.article.count({ where: { category: name } });
  if (inUse > 0) {
    return res.status(409).json({ error: `Categoria usata da ${inUse} articoli` });
  }
  const items = loadCategories().filter(c => c.name.toUpperCase() !== name);
  saveCategories(items);
  res.json({ ok: true });
});

export default router;
