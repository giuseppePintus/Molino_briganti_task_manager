import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { socketService, SocketEvents } from '../services/socketService';
import { InventoryService } from '../services/inventoryService';

const router = Router();

/**
 * GET /api/orders
 * Lista tutti gli ordini
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, status, from, to } = req.query;
    
    const where: any = {};
    
    if (type) where.type = type;
    if (status) where.status = status;
    
    // Filtro date
    if (from || to) {
      where.dateTime = {};
      if (from) where.dateTime.gte = new Date(from as string);
      if (to) where.dateTime.lte = new Date(to as string);
    }
    
    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        trip: true,
        assignedOperator: {
          select: { id: true, username: true, image: true }
        },
        items: {
          include: { article: true }
        }
      },
      orderBy: { dateTime: 'asc' }
    });
    
    // Converti products da JSON string a array
    const ordersWithProducts = orders.map(order => {
      let products = [];
      try {
        products = order.products ? JSON.parse(order.products) : [];
      } catch (parseError) {
        console.warn(`Warning: Invalid products JSON for order ${order.id}:`, order.products);
        products = [];
      }
      return {
        ...order,
        products
      };
    });
    
    res.json(ordersWithProducts);
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orders/:id
 * Ottieni singolo ordine
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        trip: true,
        assignedOperator: {
          select: { id: true, username: true, image: true }
        },
        items: {
          include: { article: true }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    let products = [];
    try {
      products = order.products ? JSON.parse(order.products) : [];
    } catch (parseError) {
      console.warn(`Warning: Invalid products JSON for order ${order.id}:`, order.products);
      products = [];
    }
    
    res.json({
      ...order,
      products
    });
  } catch (error: any) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orders
 * Crea nuovo ordine
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      type, 
      customerId, 
      clientName,
      client,  // Alias per clientName (compatibilità frontend)
      products, 
      tripId, 
      assignedOperatorId,
      dateTime,
      notes 
    } = req.body;
    
    // Accetta sia clientName che client (alias)
    const clientNameValue = clientName || client || null;
    
    const order = await prisma.order.create({
      data: {
        type,
        customerId: customerId || null,
        clientName: clientNameValue,
        products: products ? JSON.stringify(products) : null,
        tripId: tripId || null,
        assignedOperatorId: assignedOperatorId || null,
        dateTime: dateTime ? new Date(dateTime) : null,
        notes: notes || null,
        status: 'pending'
      },
      include: {
        customer: true,
        trip: true,
        assignedOperator: {
          select: { id: true, username: true, image: true }
        }
      }
    });
    
    let parsedProducts = [];
    try {
      parsedProducts = order.products ? JSON.parse(order.products) : [];
    } catch (parseError) {
      console.warn(`Warning: Invalid products JSON for order ${order.id}:`, order.products);
      parsedProducts = [];
    }
    
    const orderWithProducts = {
      ...order,
      products: parsedProducts
    };
    
    // Notifica WebSocket
    socketService.notifyOrderCreated(orderWithProducts);
    
    res.status(201).json(orderWithProducts);
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/orders/:id
 * Aggiorna ordine
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      type, 
      customerId, 
      clientName,
      client,  // Alias per clientName (compatibilità frontend)
      products, 
      tripId, 
      assignedOperatorId,
      dateTime,
      status,
      notes 
    } = req.body;
    
    const updateData: any = {};
    
    if (type !== undefined) updateData.type = type;
    if (customerId !== undefined) updateData.customerId = customerId;
    // Accetta sia clientName che client (alias)
    const clientNameValue = clientName !== undefined ? clientName : client;
    if (clientNameValue !== undefined) updateData.clientName = clientNameValue;
    if (products !== undefined) updateData.products = JSON.stringify(products);
    if (tripId !== undefined) updateData.tripId = tripId;
    
    // Gestione assegnazione operatore con timestamp
    if (assignedOperatorId !== undefined) {
      updateData.assignedOperatorId = assignedOperatorId;
      // Se viene assegnato un operatore, salva la data di assegnazione
      if (assignedOperatorId && assignedOperatorId !== null) {
        // Leggi l'ordine corrente per vedere se era già assegnato
        const currentOrder = await prisma.order.findUnique({ where: { id: parseInt(id) } });
        if (!currentOrder?.assignedOperatorId) {
          updateData.assignedAt = new Date();
        }
      }
    }
    
    if (dateTime !== undefined) updateData.dateTime = dateTime ? new Date(dateTime) : null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completedAt = new Date();
      }
      // Se lo status passa a in_progress (accettato), salva acceptedAt
      if (status === 'in_progress') {
        const currentOrder = await prisma.order.findUnique({ where: { id: parseInt(id) } });
        if (!currentOrder?.acceptedAt) {
          updateData.acceptedAt = new Date();
        }
      }
    }
    if (notes !== undefined) updateData.notes = notes;
    
    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        customer: true,
        trip: true,
        assignedOperator: {
          select: { id: true, username: true, image: true }
        }
      }
    });
    
    let parsedProducts = [];
    try {
      parsedProducts = order.products ? JSON.parse(order.products) : [];
    } catch (parseError) {
      console.warn(`Warning: Invalid products JSON for order ${order.id}:`, order.products);
      parsedProducts = [];
    }
    
    const orderWithProducts = {
      ...order,
      products: parsedProducts
    };
    
    // Notifica WebSocket (distinguo se è cambio status o update generico)
    if (status !== undefined) {
      socketService.notifyOrderStatusChanged(orderWithProducts);
    } else {
      socketService.notifyOrderUpdated(orderWithProducts);
    }
    
    res.json(orderWithProducts);
  } catch (error: any) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orders/instant-complete
 * Crea un ordine "istantaneo" (vendita banco) e contestualmente scarica
 * il magazzino dalle specifiche ShelfEntry indicate. Tutto in una singola
 * transazione: se uno qualsiasi degli scarichi fallisce per stock insufficiente
 * l'ordine NON viene creato e nessun movimento viene registrato.
 */
router.post('/instant-complete', async (req: Request, res: Response) => {
  try {
    const {
      clientName,
      customerId,
      notes,
      items,
      assignedOperatorId,
    } = req.body as {
      clientName?: string;
      customerId?: number | null;
      notes?: string;
      assignedOperatorId?: number | null;
      items: Array<{
        articleId: number;
        quantity: number;
        positionCode: string;
        shelfEntryId?: number;
        batch?: string;
        unitPrice?: number;
      }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items è obbligatorio e deve contenere almeno una riga' });
    }

    for (const it of items) {
      if (!it || typeof it.articleId !== 'number' || !it.positionCode) {
        return res.status(400).json({ error: 'Ogni item richiede articleId e positionCode' });
      }
      const q = Number(it.quantity);
      if (!Number.isFinite(q) || q <= 0) {
        return res.status(400).json({ error: `Quantità non valida per articolo ${it.articleId}` });
      }
    }

    const userId = (req as any).user?.id ?? 1;
    const finalClientName = (clientName && clientName.trim()) || 'Banco';

    const result = await prisma.$transaction(async (tx) => {
      type Resolved = {
        item: typeof items[number];
        shelfEntry: { id: number; articleId: number; positionCode: string; quantity: number; batch: string | null };
        article: { id: number; code: string; name: string };
        inventory: { id: number; currentStock: number; minimumStock: number };
      };

      const resolved: Resolved[] = [];

      for (const it of items) {
        const qty = Number(it.quantity);

        let shelfEntry;
        if (it.shelfEntryId) {
          shelfEntry = await tx.shelfEntry.findUnique({ where: { id: it.shelfEntryId } });
          if (!shelfEntry || shelfEntry.articleId !== it.articleId || shelfEntry.positionCode !== it.positionCode) {
            throw new Error(`ShelfEntry ${it.shelfEntryId} non corrisponde a articolo ${it.articleId} / posizione ${it.positionCode}`);
          }
        } else {
          shelfEntry = await tx.shelfEntry.findFirst({
            where: { articleId: it.articleId, positionCode: it.positionCode },
            orderBy: { id: 'asc' },
          });
          if (!shelfEntry) {
            throw new Error(`Nessuna giacenza trovata per articolo ${it.articleId} sulla posizione ${it.positionCode}`);
          }
        }

        if (shelfEntry.quantity < qty) {
          throw new Error(`Stock insufficiente: posizione ${shelfEntry.positionCode} ha ${shelfEntry.quantity} colli, richiesti ${qty}`);
        }

        const article = await tx.article.findUnique({ where: { id: it.articleId } });
        if (!article) throw new Error(`Articolo ${it.articleId} non trovato`);

        // ShelfEntry è la fonte autorevole della giacenza fisica.
        // Inventory.currentStock è una cache aggregata che può essere disallineata:
        // la risincronizziamo dalla somma reale delle ShelfEntry per evitare falsi
        // "stock insufficiente" quando la cache è stale.
        const shelfAgg = await tx.shelfEntry.aggregate({
          where: { articleId: it.articleId },
          _sum: { quantity: true },
        });
        const realShelfStock = shelfAgg._sum.quantity ?? 0;

        let inventory = await tx.inventory.findUnique({ where: { articleId: it.articleId } });
        if (!inventory) {
          inventory = await tx.inventory.create({
            data: { articleId: it.articleId, currentStock: realShelfStock, minimumStock: 0 },
          });
        } else if (inventory.currentStock !== realShelfStock) {
          // Risincronizza la cache prima di procedere
          inventory = await tx.inventory.update({
            where: { id: inventory.id },
            data: { currentStock: realShelfStock },
          });
        }

        if (realShelfStock < qty) {
          throw new Error(`Stock insufficiente per ${article.code}: ${realShelfStock} colli totali a magazzino, richiesti ${qty}`);
        }

        resolved.push({ item: it, shelfEntry, article, inventory });
      }

      const productsJson = JSON.stringify(
        resolved.map(r => ({
          product: r.article.name,
          code: r.article.code,
          quantity: Number(r.item.quantity),
          unit: 'colli',
          positionCode: r.item.positionCode,
          batch: r.item.batch || r.shelfEntry.batch || null,
        }))
      );

      const order = await tx.order.create({
        data: {
          type: 'istantaneo',
          customerId: customerId ?? null,
          clientName: finalClientName,
          products: productsJson,
          status: 'completed',
          completedAt: new Date(),
          notes: notes || null,
          assignedOperatorId: typeof assignedOperatorId === 'number' ? assignedOperatorId : null,
        },
      });

      for (const r of resolved) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            articleId: r.article.id,
            quantityOrdered: Number(r.item.quantity),
            quantityDelivered: Number(r.item.quantity),
            unitPrice: typeof r.item.unitPrice === 'number' ? r.item.unitPrice : null,
          },
        });
      }

      const movements: Array<{ articleId: number; positionCode: string; shelfEntryId: number; quantity: number }> = [];

      for (const r of resolved) {
        const qty = Number(r.item.quantity);

        await tx.shelfEntry.update({
          where: { id: r.shelfEntry.id },
          data: { quantity: r.shelfEntry.quantity - qty },
        });

        const newStock = r.inventory.currentStock - qty;
        await tx.inventory.update({
          where: { id: r.inventory.id },
          data: { currentStock: newStock },
        });

        await tx.stockMovement.create({
          data: {
            inventoryId: r.inventory.id,
            type: 'OUT',
            quantity: qty,
            reason: 'ORDINE_ISTANTANEO',
            orderId: order.id,
            notes: `Posizione: ${r.shelfEntry.positionCode}${r.item.batch ? ` · Lotto: ${r.item.batch}` : ''}`,
            createdBy: userId,
          },
        });

        if (r.inventory.minimumStock > 0 && newStock <= r.inventory.minimumStock) {
          const existingAlert = await tx.stockAlert.findFirst({
            where: { articleId: r.article.id, alertType: 'LOW_STOCK', isResolved: false },
          });
          if (!existingAlert) {
            await tx.stockAlert.create({
              data: {
                articleId: r.article.id,
                inventoryId: r.inventory.id,
                alertType: 'LOW_STOCK',
                currentStock: newStock,
                minimumStock: r.inventory.minimumStock,
              },
            });
          }
        }

        movements.push({
          articleId: r.article.id,
          positionCode: r.shelfEntry.positionCode,
          shelfEntryId: r.shelfEntry.id,
          quantity: qty,
        });
      }

      const fullOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          customer: true,
          items: { include: { article: true } },
        },
      });

      return { order: fullOrder, movements };
    });

    socketService.broadcast(SocketEvents.INVENTORY_UPDATED, { type: 'instant-order', orderId: result.order?.id });
    if (result.order) {
      const orderForSocket = {
        ...result.order,
        products: result.order.products ? JSON.parse(result.order.products) : [],
      };
      socketService.notifyOrderCreated(orderForSocket);
    }

    return res.status(201).json(result);
  } catch (error: any) {
    console.error('❌ Errore /orders/instant-complete:', error?.message || error);
    return res.status(400).json({ error: error?.message || 'Errore creazione ordine istantaneo' });
  }
});

/**
 * DELETE /api/orders/:id
 * Elimina ordine e rilascia eventuali prenotazioni inventario
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Leggi l'ordine prima di eliminarlo per rilasciare le prenotazioni
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) }
    });

    // Rilascia le prenotazioni di inventario se l'ordine non è completato
    if (order && order.status !== 'completed' && order.products) {
      try {
        const products = JSON.parse(order.products);
        for (const item of products) {
          const code = item.product || item.code;
          const quantity = item.quantity;
          if (code && quantity) {
            try {
              await InventoryService.releaseReservation(code, quantity);
              console.log(`✅ Prenotazione rilasciata: ${code} ${quantity}kg`);
            } catch (releaseErr) {
              // Non bloccare la cancellazione per errori di rilascio
              console.warn(`⚠️ Rilascio prenotazione fallito per ${code}:`, releaseErr);
            }
          }
        }
      } catch (parseErr) {
        console.warn('⚠️ Impossibile parsare products per rilascio prenotazioni:', parseErr);
      }
    }
    
    await prisma.order.delete({
      where: { id: parseInt(id) }
    });

    // Notifica WebSocket: ordine eliminato (refresh generico)
    socketService.requestDataRefresh('orders');

    res.json({ success: true, message: 'Order deleted' });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orders/bulk
 * Importa ordini in blocco (per migrazione da localStorage)
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { orders } = req.body;
    
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders must be an array' });
    }
    
    const created = await prisma.$transaction(
      orders.map(order => prisma.order.create({
        data: {
          type: order.type,
          customerId: order.customerId || null,
          clientName: order.client || order.clientName || null,
          products: order.products ? JSON.stringify(order.products) : 
                   (order.product ? JSON.stringify([{ product: order.product, quantity: order.quantity || 1 }]) : null),
          tripId: order.tripId || null,
          assignedOperatorId: order.operatorId || order.assignedOperatorId || null,
          dateTime: order.dateTime ? new Date(order.dateTime) : null,
          notes: order.notes || null,
          status: order.status || 'pending'
        }
      }))
    );
    
    res.status(201).json({ 
      success: true, 
      count: created.length,
      message: `${created.length} orders imported`
    });
  } catch (error: any) {
    console.error('Error bulk importing orders:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
