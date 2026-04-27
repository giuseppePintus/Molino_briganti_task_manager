import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

/**
 * GET /api/alerts
 * Calcola live gli avvisi attivi confrontando la giacenza DISPONIBILE
 * (= colli sugli scaffali − colli prenotati da ordini) con minimumStock / criticalStock.
 *
 *  level: 'CRITICAL' se available <= criticalStock (e criticalStock > 0)
 *         'LOW'      se available <= minimumStock  (e minimumStock  > 0)
 *
 * Risposta: { count, alerts: [{ articleId, code, name, category, unit, weightPerUnit,
 *             currentStock, reservedStock, availableStock,
 *             minimumStock, criticalStock, level, reason }] }
 *  reason: 'STOCK' se l'avviso scatta sulla sola giacenza fisica,
 *          'RESERVED' se scatta solo a causa delle prenotazioni.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const inventories = await prisma.inventory.findMany({
      where: {
        OR: [
          { minimumStock: { gt: 0 } },
          { criticalStock: { gt: 0 } }
        ]
      },
      include: { article: { include: { shelfEntries: true } } }
    });
    // Snooze fields letti via raw SQL (il client Prisma in container può non averli ancora)
    const snoozeMap = new Map<number, { snoozedAt: Date | null; snoozedAtStock: number | null }>();
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        'SELECT id, snoozedAt, snoozedAtStock FROM Inventory WHERE snoozedAt IS NOT NULL'
      );
      for (const r of rows) snoozeMap.set(Number(r.id), { snoozedAt: r.snoozedAt, snoozedAtStock: r.snoozedAtStock });
    } catch (_) { /* colonne assenti: nessun snooze attivo */ }

    const alerts = inventories
      .map((inv: any) => {
        const min = inv.minimumStock || 0;
        const crit = inv.criticalStock || 0;
        const shelfTotal = (inv.article?.shelfEntries || [])
          .reduce((s: number, e: any) => s + (e.quantity || 0), 0);
        const cur = shelfTotal; // colli fisici sugli scaffali
        // `inv.reserved` è memorizzato in KG: convertilo in colli (arrotondato per eccesso)
        const wpu = (inv.article?.weightPerUnit && inv.article.weightPerUnit > 0)
          ? inv.article.weightPerUnit : 1;
        const reservedColli = Math.ceil((inv.reserved || 0) / wpu);
        const available = Math.max(0, cur - reservedColli);

        let level: 'CRITICAL' | 'LOW' | null = null;
        if (crit > 0 && available <= crit) level = 'CRITICAL';
        else if (min > 0 && available <= min) level = 'LOW';
        if (!level) return null;

        // Reason: 'STOCK' se anche senza prenotazioni saremmo già sotto soglia,
        //          altrimenti 'RESERVED' (l'allerta è dovuta alle prenotazioni).
        let stockOnlyLevel: 'CRITICAL' | 'LOW' | null = null;
        if (crit > 0 && cur <= crit) stockOnlyLevel = 'CRITICAL';
        else if (min > 0 && cur <= min) stockOnlyLevel = 'LOW';
        const reason: 'STOCK' | 'RESERVED' = stockOnlyLevel ? 'STOCK' : 'RESERVED';

        // Snooze: se è stato creato un ordine interno e il magazzino non è ancora
        // stato ricaricato (shelfTotal <= snoozedAtStock), considera l'avviso "in corso".
        const sn = snoozeMap.get(inv.id);
        const snoozedAtStock = sn?.snoozedAtStock ?? null;
        const snoozedAt = sn?.snoozedAt ?? null;
        const snoozed = (snoozedAt != null && snoozedAtStock != null && cur <= snoozedAtStock);

        return {
          articleId: inv.articleId,
          inventoryId: inv.id,
          code: inv.article?.code,
          name: inv.article?.name,
          category: inv.article?.category,
          unit: inv.article?.unit,
          weightPerUnit: inv.article?.weightPerUnit,
          currentStock: cur,
          reservedStock: reservedColli,
          availableStock: available,
          minimumStock: min,
          criticalStock: crit,
          level,
          reason,
          snoozed,
          snoozedAt: snoozed ? snoozedAt : null
        };
      })
      .filter(Boolean);

    // CRITICAL prima, poi LOW; snoozed in fondo; per ciascun gruppo, availableStock crescente
    alerts.sort((a: any, b: any) => {
      if (a.snoozed !== b.snoozed) return a.snoozed ? 1 : -1;
      if (a.level !== b.level) return a.level === 'CRITICAL' ? -1 : 1;
      return a.availableStock - b.availableStock;
    });

    // count: solo gli avvisi non in snooze (= quelli che fanno suonare la campanella)
    const activeCount = alerts.filter((a: any) => !a.snoozed).length;

    // Restocks: articoli con snoozedAt ancora settato ma il cui shelfTotal corrente
    // è risalito sopra lo snoozedAtStock => merce arrivata. Rimangono finché un admin
    // non rimuove lo snooze (o l'avviso si chiude da solo perché stock > soglie).
    const restocks: any[] = [];
    try {
      const allInv = await prisma.inventory.findMany({
        where: { id: { in: Array.from(snoozeMap.keys()) } },
        include: { article: { include: { shelfEntries: true } } }
      });
      for (const inv of allInv) {
        const sn = snoozeMap.get(inv.id);
        if (!sn || sn.snoozedAtStock == null) continue;
        const shelfTotal = ((inv as any).article?.shelfEntries || [])
          .reduce((s: number, e: any) => s + (e.quantity || 0), 0);
        if (shelfTotal > sn.snoozedAtStock) {
          restocks.push({
            articleId: inv.articleId,
            inventoryId: inv.id,
            code: (inv as any).article?.code,
            name: (inv as any).article?.name,
            snoozedAtStock: sn.snoozedAtStock,
            currentStock: shelfTotal,
            delta: shelfTotal - sn.snoozedAtStock
          });
        }
      }
    } catch (_) { /* ignore */ }

    res.json({ count: activeCount, total: alerts.length, restocks, alerts });
  } catch (e: any) {
    console.error('[alerts] errore', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/alerts/snooze
 * Body: { articleId: number }
 * Marca l'inventario come "ordine in corso": l'avviso resta in lista ma non incide
 * sul contatore finché lo shelfTotal non risale sopra il valore snapshot.
 */
router.post('/snooze', async (req: Request, res: Response) => {
  try {
    const articleId = Number(req.body?.articleId);
    if (!articleId) return res.status(400).json({ error: 'articleId mancante' });
    const inv = await prisma.inventory.findFirst({
      where: { articleId },
      include: { article: { include: { shelfEntries: true } } }
    });
    if (!inv) return res.status(404).json({ error: 'Inventory non trovato' });
    const shelfTotal = ((inv as any).article?.shelfEntries || [])
      .reduce((s: number, e: any) => s + (e.quantity || 0), 0);
    // Raw SQL: il client Prisma in container potrebbe non conoscere ancora le colonne snooze
    await prisma.$executeRawUnsafe(
      'UPDATE Inventory SET snoozedAt = ?, snoozedAtStock = ? WHERE id = ?',
      new Date(), shelfTotal, inv.id
    );
    res.json({ ok: true, articleId, snoozedAtStock: shelfTotal });
  } catch (e: any) {
    console.error('[alerts/snooze] errore', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/alerts/unsnooze
 * Body: { articleId: number }
 * Rimuove manualmente lo snooze.
 */
router.post('/unsnooze', async (req: Request, res: Response) => {
  try {
    const articleId = Number(req.body?.articleId);
    if (!articleId) return res.status(400).json({ error: 'articleId mancante' });
    const inv = await prisma.inventory.findFirst({ where: { articleId } });
    if (!inv) return res.status(404).json({ error: 'Inventory non trovato' });
    await prisma.$executeRawUnsafe(
      'UPDATE Inventory SET snoozedAt = NULL, snoozedAtStock = NULL WHERE id = ?',
      inv.id
    );
    res.json({ ok: true, articleId });
  } catch (e: any) {
    console.error('[alerts/unsnooze] errore', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
