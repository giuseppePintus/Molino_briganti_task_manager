import prisma from '../lib/prisma';
import { socketService, SocketEvents } from './socketService';

export interface PackagingConsumptionContext {
  reason: string;
  username?: string;
  useContainer?: boolean;
}

export interface PackagingConsumptionResult {
  consumed: Array<{ code: string; role: string; quantity: number; shortage: number }>;
  warnings: string[];
}

const EMPTY_RESULT: PackagingConsumptionResult = { consumed: [], warnings: [] };

/** Somma dei colli presenti sugli scaffali per un articolo: è la fonte di verità della giacenza. */
export async function getShelfTotal(articleId: number): Promise<number> {
  const agg = await prisma.shelfEntry.aggregate({ where: { articleId }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

/**
 * Scala gli imballaggi associati a un articolo quando vengono caricati `colli` colli.
 * PRIMARY consuma 1 pezzo per collo, CONTAINER 1 pezzo ogni `colliPerUnit` colli (arrotondato per eccesso).
 * Non solleva mai eccezioni: il carico merce non deve fallire per colpa degli imballaggi.
 */
export async function consumePackagingForLoad(
  articleId: number,
  colli: number,
  ctx: PackagingConsumptionContext
): Promise<PackagingConsumptionResult> {
  if (!articleId || !Number.isFinite(colli) || colli <= 0) return EMPTY_RESULT;

  try {
    const links = await prisma.articlePackaging.findMany({
      where: { articleId },
      include: { item: true },
    });
    if (!links.length) return EMPTY_RESULT;

    const useContainer = ctx.useContainer !== false;
    const result: PackagingConsumptionResult = { consumed: [], warnings: [] };

    for (const link of links) {
      const isContainer = link.role === 'CONTAINER';
      if (isContainer && !useContainer) continue;

      const perUnit = isContainer ? Math.max(1, link.colliPerUnit) : 1;
      const required = isContainer ? Math.ceil(colli / perUnit) : colli;
      if (required <= 0) continue;

      const outcome = await consumeItem(link.packagingItemId, required, articleId, ctx);
      result.consumed.push({
        code: link.item.code,
        role: link.role,
        quantity: outcome.taken,
        shortage: outcome.shortage,
      });
      if (outcome.shortage > 0) {
        result.warnings.push(`Imballaggio ${link.item.code}: mancano ${outcome.shortage} pezzi`);
      }
    }

    if (result.consumed.length) {
      socketService.broadcast(SocketEvents.PACKAGING_UPDATED, { type: 'consumption', articleId });
    }
    return result;
  } catch (e: any) {
    console.error('⚠️ [PACKAGING] consumo imballaggi fallito:', e?.message || e);
    return EMPTY_RESULT;
  }
}

/** Preleva `required` pezzi a cascata dalle posizioni con giacenza, ordinate per codice. */
async function consumeItem(
  itemId: number,
  required: number,
  articleId: number,
  ctx: PackagingConsumptionContext
): Promise<{ taken: number; shortage: number }> {
  return prisma.$transaction(async (tx) => {
    const entries = await tx.packagingEntry.findMany({
      where: { itemId, quantity: { gt: 0 } },
      orderBy: { positionCode: 'asc' },
    });

    let remaining = required;
    for (const entry of entries) {
      if (remaining <= 0) break;
      const take = Math.min(entry.quantity, remaining);
      await tx.packagingEntry.update({ where: { id: entry.id }, data: { quantity: entry.quantity - take } });
      await tx.packagingMovement.create({
        data: {
          itemId,
          positionCode: entry.positionCode,
          type: 'OUT',
          quantity: take,
          articleId,
          reason: ctx.reason,
          createdBy: ctx.username || null,
        },
      });
      remaining -= take;
    }

    if (remaining > 0) {
      // Deficit registrato come movimento a quantità zero, così resta visibile negli avvisi
      await tx.packagingMovement.create({
        data: {
          itemId,
          type: 'OUT',
          quantity: 0,
          shortage: remaining,
          articleId,
          reason: ctx.reason,
          createdBy: ctx.username || null,
        },
      });
    }

    return { taken: required - remaining, shortage: remaining };
  });
}
