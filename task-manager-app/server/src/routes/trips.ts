import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

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
    
    res.status(201).json({
      ...fullTrip,
      sequence: fullTrip?.sequence ? JSON.parse(fullTrip.sequence) : [],
      orders: fullTrip?.orders.map(order => ({
        ...order,
        products: order.products ? JSON.parse(order.products) : []
      }))
    });
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
    
    res.json({
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
    });
  } catch (error: any) {
    console.error('Error updating trip:', error);
    res.status(500).json({ error: error.message });
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
