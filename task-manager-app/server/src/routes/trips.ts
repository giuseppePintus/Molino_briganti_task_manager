import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { socketService } from '../services/socketService';
import { InventoryService } from '../services/inventoryService';
import { appendAuditLog, getAuditLogFilePath } from '../services/auditLogService';

const router = Router();

function buildDiagFlowId(req: Request): string {
  const headerFlowId = req.headers['x-flow-id'] || req.headers['x-request-id'];
  if (typeof headerFlowId === 'string' && headerFlowId.trim().length > 0) {
    return headerFlowId.trim();
  }
  return `diag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseTripOrderProducts(productsRaw: string | null): any[] {
  if (!productsRaw) return [];
  try {
    const parsed = JSON.parse(productsRaw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function summarizeTripProducts(products: any[]): Array<{ code: string | null; product: string | null; quantity: number | null }> {
  return products.map((product: any) => ({
    code: product?.code || null,
    product: product?.product || null,
    quantity: typeof product?.quantity === 'number' ? product.quantity : Number(product?.quantity ?? null),
  }));
}

/**
 * GET /api/trips
 * Lista tutti i viaggi
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, from, to, operatorId } = req.query;
    
    const where: any = {};
    
    if (status) where.status = status;
    if (operatorId) where.assignedOperatorId = parseInt(operatorId as string);
    
    // Filtro date
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }
    
    const trips = await prisma.trip.findMany({
      where,
      include: {
        assignedOperator: {
          select: { id: true, username: true, image: true }
        },
        orders: {
          include: {
            customer: true
          }
        }
      },
      orderBy: { date: 'asc' }
    });
    
    // Converti orders.products da JSON string a array e sequence da JSON string a array
    const tripsWithProducts = await Promise.all(trips.map(async trip => {
      let sequence = [];
      let orders = trip.orders;
      
      try {
        sequence = trip.sequence ? JSON.parse(trip.sequence) : [];
      } catch (parseError) {
        console.warn(`Warning: Invalid sequence JSON for trip ${trip.id}:`, trip.sequence);
        sequence = [];
      }
      
      try {
        orders = trip.orders.map(order => {
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
      } catch (parseError) {
        console.warn(`Warning: Error parsing orders for trip ${trip.id}:`, parseError);
      }
      
      // Se la sequence è vuota ma ci sono ordini collegati via tripId, ricostruiscila
      if (sequence.length === 0 && orders.length > 0) {
        sequence = orders.map((o: any) => o.id);
        console.log(`🔧 Rebuilding sequence for trip ${trip.id} from DB orders: [${sequence.join(',')}]`);
        await prisma.trip.update({
          where: { id: trip.id },
          data: { sequence: JSON.stringify(sequence) }
        });
      }
      
      return {
        ...trip,
        sequence,
        accepted: trip.accepted !== undefined ? trip.accepted : false,
        acceptedAt: trip.acceptedAt || null,
        printed: trip.printed !== undefined ? trip.printed : false,
        printedAt: trip.printedAt || null,
        orders
      };
    }));
    
    res.json(tripsWithProducts);
  } catch (error: any) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trips/:id
 * Ottieni singolo viaggio
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const trip = await prisma.trip.findUnique({
      where: { id: parseInt(id) },
      include: {
        assignedOperator: {
          select: { id: true, username: true, image: true }
        },
        orders: {
          include: {
            customer: true
          }
        }
      }
    });
    
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    let sequence = [];
    try {
      sequence = trip.sequence ? JSON.parse(trip.sequence) : [];
    } catch (parseError) {
      console.warn(`Warning: Invalid sequence JSON for trip ${trip.id}:`, trip.sequence);
      sequence = [];
    }
    
    let orders = trip.orders;
    try {
      orders = trip.orders.map(order => {
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
    } catch (parseError) {
      console.warn(`Warning: Error parsing orders for trip ${trip.id}:`, parseError);
    }
    
    // Se la sequence è vuota ma ci sono ordini collegati via tripId, ricostruiscila
    if (sequence.length === 0 && orders.length > 0) {
      sequence = orders.map((o: any) => o.id);
      console.log(`🔧 Rebuilding sequence for trip ${trip.id} from DB orders: [${sequence.join(',')}]`);
      await prisma.trip.update({
        where: { id: trip.id },
        data: { sequence: JSON.stringify(sequence) }
      });
    }
    
    res.json({
      ...trip,
      sequence,
      orders
    });
  } catch (error: any) {
    console.error('Error fetching trip:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trips
 * Crea nuovo viaggio
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      date, 
      assignedOperatorId,
      vehicleId,
      vehicleName,
      sequence,
      notes 
    } = req.body;
    
    // Crea il viaggio senza includere orders subito
    const trip = await prisma.trip.create({
      data: {
        name,
        date: new Date(date),
        assignedOperatorId: assignedOperatorId || null,
        vehicleId: vehicleId || null,
        vehicleName: vehicleName || null,
        sequence: sequence ? JSON.stringify(sequence) : null,
        notes: notes || null,
        status: 'planned'
      }
    });
    
    // Recupera il viaggio completo con relazioni
    const fullTrip = await prisma.trip.findUnique({
      where: { id: trip.id },
      include: {
        assignedOperator: {
          select: { id: true, username: true, image: true }
        },
        orders: true
      }
    });
    
    const tripResponse = {
      ...fullTrip,
      sequence: fullTrip?.sequence ? JSON.parse(fullTrip.sequence) : [],
      orders: fullTrip?.orders.map(order => ({
        ...order,
        products: order.products ? JSON.parse(order.products) : []
      }))
    };
    socketService.notifyTripCreated(tripResponse);
    res.status(201).json(tripResponse);
  } catch (error: any) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/trips/:id
 * Aggiorna viaggio
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      date, 
      assignedOperatorId,
      vehicleId,
      vehicleName,
      sequence,
      status,
      accepted,
      printed,
      notes 
    } = req.body;
    
    console.log('🔵 PUT /trips/:id called with id=%s, accepted=%s', id, accepted);
    
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (date !== undefined) updateData.date = new Date(date);
    if (assignedOperatorId !== undefined) updateData.assignedOperatorId = assignedOperatorId;
    if (vehicleId !== undefined) updateData.vehicleId = vehicleId;
    if (vehicleName !== undefined) updateData.vehicleName = vehicleName;
    if (sequence !== undefined) updateData.sequence = Array.isArray(sequence) ? JSON.stringify(sequence) : sequence;
    if (notes !== undefined) updateData.notes = notes;
    if (accepted !== undefined) {
      updateData.accepted = accepted;
      if (accepted) {
        updateData.acceptedAt = new Date();
      }
    }
    if (printed !== undefined) {
      updateData.printed = printed;
      if (printed) {
        updateData.printedAt = new Date();
        // Se viene stampato, marca anche come accettato
        updateData.accepted = true;
        if (!updateData.acceptedAt) {
          updateData.acceptedAt = new Date();
        }
      }
    }
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'in_progress') {
        updateData.startedAt = new Date();
      } else if (status === 'completed') {
        updateData.completedAt = new Date();
      }
    }
    
    console.log('🟡 updateData:', updateData);
    
    const trip = await prisma.trip.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        assignedOperator: {
          select: { id: true, username: true, image: true }
        },
        orders: {
          include: { customer: true }
        }
      }
    });
    
    console.log('🟢 Trip updated successfully - id=%s, accepted=%s, acceptedAt=%s', trip.id, trip.accepted, trip.acceptedAt);
    
    const tripResponse = {
      ...trip,
      sequence: trip.sequence ? JSON.parse(trip.sequence) : [],
      accepted: trip.accepted !== undefined ? trip.accepted : false,
      acceptedAt: trip.acceptedAt || null,
      printed: trip.printed !== undefined ? trip.printed : false,
      printedAt: trip.printedAt || null,
      orders: trip.orders.map(order => ({
        ...order,
        products: order.products ? JSON.parse(order.products) : []
      }))
    };
    socketService.notifyTripUpdated(tripResponse);
    res.json(tripResponse);
  } catch (error: any) {
    console.error('Error updating trip:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trips/:id/complete
 * Completa un viaggio lato backend: valida, consuma inventario e chiude ordini/viaggio.
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tripId = parseInt(id);
    const flowId = buildDiagFlowId(req);
    const userId = (req as any).user?.id ?? null;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        assignedOperator: {
          select: { id: true, username: true, image: true }
        },
        orders: {
          include: { customer: true },
          orderBy: { id: 'asc' }
        }
      }
    });

  /**
   * POST /api/trips/:id/audit
   * Traccia eventi operativi lato frontend per i viaggi.
   */
  router.post('/:id/audit', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tripId = parseInt(id);
      const flowId = buildDiagFlowId(req);
      const userId = (req as any).user?.id ?? null;
      const { action, details } = req.body || {};

      if (!action || typeof action !== 'string') {
        return res.status(400).json({ error: 'action mancante' });
      }

      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        include: {
          assignedOperator: {
            select: { id: true, username: true, image: true }
          },
          orders: {
            include: { customer: true },
            orderBy: { id: 'asc' }
          }
        }
      });

      console.log('🔎 [DIAG][TRIP_AUDIT]', {
        flowId,
        action,
        userId,
        tripId,
        tripStatus: trip?.status ?? null,
        accepted: trip?.accepted ?? null,
        acceptedAt: trip?.acceptedAt ?? null,
        printed: trip?.printed ?? null,
        printedAt: trip?.printedAt ?? null,
        sequence: trip?.sequence ? JSON.parse(trip.sequence) : [],
        orderIds: trip?.orders?.map((order) => order.id) ?? [],
        products: trip?.orders?.flatMap((order) => summarizeTripProducts(parseTripOrderProducts(order.products))) ?? [],
        details: details || null,
      });

      await appendAuditLog({
        scope: 'trip',
        action,
        flowId,
        userId,
        tripId,
        details: details || null,
        logFile: getAuditLogFilePath(),
      });

      return res.json({ ok: true });
    } catch (error: any) {
      console.error('❌ [DIAG][TRIP_AUDIT_ERROR]', {
        flowId: buildDiagFlowId(req),
        tripId: req.params?.id ?? null,
        userId: (req as any).user?.id ?? null,
        action: req.body?.action ?? null,
        error: error?.message || String(error),
      });
      return res.status(500).json({ error: error?.message || 'Errore audit viaggio' });
    }
  });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const pendingOrders = trip.orders.filter((order) => order.status !== 'completed');
    if (pendingOrders.length === 0) {
      const completedTrip = await prisma.trip.update({
        where: { id: tripId },
        data: { status: 'completed', completedAt: new Date() },
        include: {
          assignedOperator: {
            select: { id: true, username: true, image: true }
          },
          orders: { include: { customer: true } }
        }
      });

      socketService.notifyTripUpdated({
        ...completedTrip,
        sequence: completedTrip.sequence ? JSON.parse(completedTrip.sequence) : [],
        orders: completedTrip.orders.map((order) => ({
          ...order,
          products: parseTripOrderProducts(order.products)
        }))
      });

      return res.json({
        trip: completedTrip,
        consumeSummary: { consumeOk: 0, consumeErr: 0, alreadyCompleted: true }
      });
    }

    const validationRows: Array<{
      orderId: number;
      code: string;
      quantityKg: number;
      colliDemand: number;
      expectedPositionCode: string;
      expectedBatch: string | null;
      strictShelfStock: number;
      realShelfStock: number;
      inventoryStock: number;
      reservedKg: number;
    }> = [];

    for (const order of pendingOrders) {
      const products = parseTripOrderProducts(order.products);
      for (const product of products) {
        const code = product?.code || product?.product;
        const quantityKg = Number(product?.quantity || 0);
        const expectedPositionCode = String(product?.shelfPosition || product?.positionCode || '').trim();
        const expectedBatch = String(product?.batch || '').trim();
        if (!code || !Number.isFinite(quantityKg) || quantityKg <= 0) {
          continue;
        }

        if (!expectedPositionCode) {
          return res.status(409).json({
            error: `Mismatch prenotazione per ${code}: posizione non presente nella riga ordine`,
            flowId,
            tripId,
            orderId: order.id,
            code,
            quantityKg,
          });
        }

        const article = await prisma.article.findFirst({
          where: { code },
          include: {
            inventory: true,
            shelfEntries: { orderBy: { id: 'asc' } }
          }
        });

        if (!article || !article.inventory) {
          return res.status(409).json({
            error: `Articolo ${code} non trovato o senza inventario`,
            flowId,
            tripId,
            orderId: order.id,
            code,
          });
        }

        const weightPerUnit = article.weightPerUnit || 1;
        const colliDemand = Math.ceil(quantityKg / weightPerUnit);
        const realShelfStock = article.shelfEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
        const strictShelfStock = article.shelfEntries
          .filter((entry) => entry.positionCode === expectedPositionCode && (!expectedBatch || (entry.batch || '') === expectedBatch))
          .reduce((sum, entry) => sum + (entry.quantity || 0), 0);

        if (realShelfStock < colliDemand) {
          return res.status(409).json({
            error: `Stock insufficiente per ${code}: scaffale=${realShelfStock}, richiesti=${colliDemand}`,
            flowId,
            tripId,
            orderId: order.id,
            code,
            quantityKg,
            colliDemand,
            realShelfStock,
          });
        }

        if (strictShelfStock < colliDemand) {
          return res.status(409).json({
            error: `Mismatch prenotazione per ${code}: posizione=${expectedPositionCode}, lotto=${expectedBatch || 'N/D'}, disponibili=${strictShelfStock}, richiesti=${colliDemand}`,
            flowId,
            tripId,
            orderId: order.id,
            code,
            quantityKg,
            colliDemand,
            expectedPositionCode,
            expectedBatch: expectedBatch || null,
            strictShelfStock,
          });
        }

        validationRows.push({
          orderId: order.id,
          code,
          quantityKg,
          colliDemand,
          expectedPositionCode,
          expectedBatch: expectedBatch || null,
          strictShelfStock,
          realShelfStock,
          inventoryStock: article.inventory.currentStock || 0,
          reservedKg: article.inventory.reserved || 0,
        });
      }
    }

    console.log('🔎 [DIAG][TRIP_COMPLETE_VALIDATE]', {
      flowId,
      tripId,
      userId,
      pendingOrderIds: pendingOrders.map((order) => order.id),
      rows: validationRows,
    });

    let consumeOk = 0;
    for (const order of pendingOrders) {
      const products = parseTripOrderProducts(order.products);
      for (const product of products) {
        const code = product?.code || product?.product;
        const quantityKg = Number(product?.quantity || 0);
        if (!code || !Number.isFinite(quantityKg) || quantityKg <= 0) {
          continue;
        }

        await InventoryService.consumeReservedInventory(code, quantityKg, {
          flowId,
          userId,
          orderId: order.id,
          tripId,
          source: 'trip.complete',
          orderType: order.type ?? null,
          strictLocation: true,
          expectedPositionCode: String(product?.shelfPosition || product?.positionCode || '').trim(),
          expectedBatch: String(product?.batch || '').trim() || null,
        });
        consumeOk++;
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const order of pendingOrders) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'completed', completedAt: new Date() }
        });
      }

      await tx.trip.update({
        where: { id: tripId },
        data: { status: 'completed', completedAt: new Date() }
      });
    });

    const completedTrip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        assignedOperator: {
          select: { id: true, username: true, image: true }
        },
        orders: {
          include: { customer: true }
        }
      }
    });

    const tripResponse = completedTrip ? {
      ...completedTrip,
      sequence: completedTrip.sequence ? JSON.parse(completedTrip.sequence) : [],
      accepted: completedTrip.accepted !== undefined ? completedTrip.accepted : false,
      acceptedAt: completedTrip.acceptedAt || null,
      printed: completedTrip.printed !== undefined ? completedTrip.printed : false,
      printedAt: completedTrip.printedAt || null,
      orders: completedTrip.orders.map((order) => ({
        ...order,
        products: parseTripOrderProducts(order.products)
      }))
    } : null;

    if (tripResponse) {
      socketService.notifyTripUpdated(tripResponse);
    }
    socketService.requestDataRefresh('orders');

    console.log('🔎 [DIAG][TRIP_COMPLETE_SUCCESS]', {
      flowId,
      tripId,
      userId,
      consumeOk,
      completedOrderIds: pendingOrders.map((order) => order.id),
    });

    return res.json({
      trip: tripResponse,
      consumeSummary: { consumeOk, consumeErr: 0, alreadyCompleted: false }
    });
  } catch (error: any) {
    console.error('❌ [DIAG][TRIP_COMPLETE_ERROR]', {
      flowId: buildDiagFlowId(req),
      tripId: req.params?.id ?? null,
      userId: (req as any).user?.id ?? null,
      error: error?.message || String(error),
    });
    return res.status(500).json({ error: error?.message || 'Errore completamento viaggio' });
  }
});

/**
 * DELETE /api/trips/:id
 * Elimina viaggio
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Prima rimuovi il collegamento dagli ordini
    await prisma.order.updateMany({
      where: { tripId: parseInt(id) },
      data: { tripId: null }
    });
    
    await prisma.trip.delete({
      where: { id: parseInt(id) }
    });

    // Notifica WebSocket: viaggio eliminato (refresh generico per trips e orders)
    socketService.requestDataRefresh('trips');
    socketService.requestDataRefresh('orders');

    res.json({ success: true, message: 'Trip deleted' });
  } catch (error: any) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trips/:id/orders
 * Aggiungi ordini a un viaggio
 */
router.post('/:id/orders', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { orderIds } = req.body;
    
    if (!Array.isArray(orderIds)) {
      return res.status(400).json({ error: 'orderIds must be an array' });
    }
    
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { tripId: parseInt(id) }
    });
    
    const trip = await prisma.trip.findUnique({
      where: { id: parseInt(id) },
      include: {
        assignedOperator: {
          select: { id: true, username: true, image: true }
        },
        orders: {
          include: { customer: true }
        }
      }
    });

    // Notifica WebSocket: viaggio aggiornato e ordini riassegnati
    if (trip) {
      socketService.notifyTripUpdated(trip);
    }
    socketService.requestDataRefresh('orders');

    res.json(trip);
  } catch (error: any) {
    console.error('Error adding orders to trip:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/trips/:id/orders/:orderId
 * Rimuovi ordine da un viaggio
 */
router.delete('/:id/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    
    await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: { tripId: null }
    });

    // Notifica WebSocket: ordine rimosso dal viaggio
    socketService.requestDataRefresh('trips');
    socketService.requestDataRefresh('orders');

    res.json({ success: true, message: 'Order removed from trip' });
  } catch (error: any) {
    console.error('Error removing order from trip:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trips/bulk
 * Importa viaggi in blocco (per migrazione da localStorage)
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { trips } = req.body;
    
    if (!Array.isArray(trips)) {
      return res.status(400).json({ error: 'trips must be an array' });
    }
    
    const created = await prisma.$transaction(
      trips.map(trip => prisma.trip.create({
        data: {
          name: trip.name,
          date: new Date(trip.date || trip.createdAt || new Date()),
          assignedOperatorId: trip.assignedOperatorId || null,
          vehicleId: trip.vehicleId || null,
          vehicleName: trip.vehicleName || null,
          notes: trip.notes || null,
          status: trip.status || 'planned'
        }
      }))
    );
    
    res.status(201).json({ 
      success: true, 
      count: created.length,
      message: `${created.length} trips imported`
    });
  } catch (error: any) {
    console.error('Error bulk importing trips:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
