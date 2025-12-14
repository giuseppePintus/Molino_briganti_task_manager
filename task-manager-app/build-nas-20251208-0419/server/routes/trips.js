"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
/**
 * GET /api/trips
 * Lista tutti i viaggi
 */
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { status, from, to, operatorId } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (operatorId)
            where.assignedOperatorId = parseInt(operatorId);
        // Filtro date
        if (from || to) {
            where.date = {};
            if (from)
                where.date.gte = new Date(from);
            if (to)
                where.date.lte = new Date(to);
        }
        const trips = yield prisma.trip.findMany({
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
        const tripsWithProducts = trips.map(trip => {
            let sequence = [];
            let orders = trip.orders;
            try {
                sequence = trip.sequence ? JSON.parse(trip.sequence) : [];
            }
            catch (parseError) {
                console.warn(`Warning: Invalid sequence JSON for trip ${trip.id}:`, trip.sequence);
                sequence = [];
            }
            try {
                orders = trip.orders.map(order => {
                    let products = [];
                    try {
                        products = order.products ? JSON.parse(order.products) : [];
                    }
                    catch (parseError) {
                        console.warn(`Warning: Invalid products JSON for order ${order.id}:`, order.products);
                        products = [];
                    }
                    return Object.assign(Object.assign({}, order), { products });
                });
            }
            catch (parseError) {
                console.warn(`Warning: Error parsing orders for trip ${trip.id}:`, parseError);
            }
            return Object.assign(Object.assign({}, trip), { sequence,
                orders });
        });
        res.json(tripsWithProducts);
    }
    catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * GET /api/trips/:id
 * Ottieni singolo viaggio
 */
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const trip = yield prisma.trip.findUnique({
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
        }
        catch (parseError) {
            console.warn(`Warning: Invalid sequence JSON for trip ${trip.id}:`, trip.sequence);
            sequence = [];
        }
        let orders = trip.orders;
        try {
            orders = trip.orders.map(order => {
                let products = [];
                try {
                    products = order.products ? JSON.parse(order.products) : [];
                }
                catch (parseError) {
                    console.warn(`Warning: Invalid products JSON for order ${order.id}:`, order.products);
                    products = [];
                }
                return Object.assign(Object.assign({}, order), { products });
            });
        }
        catch (parseError) {
            console.warn(`Warning: Error parsing orders for trip ${trip.id}:`, parseError);
        }
        res.json(Object.assign(Object.assign({}, trip), { sequence,
            orders }));
    }
    catch (error) {
        console.error('Error fetching trip:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * POST /api/trips
 * Crea nuovo viaggio
 */
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, date, assignedOperatorId, vehicleId, vehicleName, sequence, notes } = req.body;
        // Crea il viaggio senza includere orders subito
        const trip = yield prisma.trip.create({
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
        const fullTrip = yield prisma.trip.findUnique({
            where: { id: trip.id },
            include: {
                assignedOperator: {
                    select: { id: true, username: true, image: true }
                },
                orders: true
            }
        });
        res.status(201).json(Object.assign(Object.assign({}, fullTrip), { sequence: (fullTrip === null || fullTrip === void 0 ? void 0 : fullTrip.sequence) ? JSON.parse(fullTrip.sequence) : [], orders: fullTrip === null || fullTrip === void 0 ? void 0 : fullTrip.orders.map(order => (Object.assign(Object.assign({}, order), { products: order.products ? JSON.parse(order.products) : [] }))) }));
    }
    catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * PUT /api/trips/:id
 * Aggiorna viaggio
 */
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, date, assignedOperatorId, vehicleId, vehicleName, sequence, status, notes } = req.body;
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (date !== undefined)
            updateData.date = new Date(date);
        if (assignedOperatorId !== undefined)
            updateData.assignedOperatorId = assignedOperatorId;
        if (vehicleId !== undefined)
            updateData.vehicleId = vehicleId;
        if (vehicleName !== undefined)
            updateData.vehicleName = vehicleName;
        if (sequence !== undefined)
            updateData.sequence = Array.isArray(sequence) ? JSON.stringify(sequence) : sequence;
        if (notes !== undefined)
            updateData.notes = notes;
        if (status !== undefined) {
            updateData.status = status;
            if (status === 'in_progress') {
                updateData.startedAt = new Date();
            }
            else if (status === 'completed') {
                updateData.completedAt = new Date();
            }
        }
        const trip = yield prisma.trip.update({
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
        res.json(Object.assign(Object.assign({}, trip), { sequence: trip.sequence ? JSON.parse(trip.sequence) : [], orders: trip.orders.map(order => (Object.assign(Object.assign({}, order), { products: order.products ? JSON.parse(order.products) : [] }))) }));
    }
    catch (error) {
        console.error('Error updating trip:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * DELETE /api/trips/:id
 * Elimina viaggio
 */
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Prima rimuovi il collegamento dagli ordini
        yield prisma.order.updateMany({
            where: { tripId: parseInt(id) },
            data: { tripId: null }
        });
        yield prisma.trip.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true, message: 'Trip deleted' });
    }
    catch (error) {
        console.error('Error deleting trip:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * POST /api/trips/:id/orders
 * Aggiungi ordini a un viaggio
 */
router.post('/:id/orders', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { orderIds } = req.body;
        if (!Array.isArray(orderIds)) {
            return res.status(400).json({ error: 'orderIds must be an array' });
        }
        yield prisma.order.updateMany({
            where: { id: { in: orderIds } },
            data: { tripId: parseInt(id) }
        });
        const trip = yield prisma.trip.findUnique({
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
    }
    catch (error) {
        console.error('Error adding orders to trip:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * DELETE /api/trips/:id/orders/:orderId
 * Rimuovi ordine da un viaggio
 */
router.delete('/:id/orders/:orderId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { orderId } = req.params;
        yield prisma.order.update({
            where: { id: parseInt(orderId) },
            data: { tripId: null }
        });
        res.json({ success: true, message: 'Order removed from trip' });
    }
    catch (error) {
        console.error('Error removing order from trip:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * POST /api/trips/bulk
 * Importa viaggi in blocco (per migrazione da localStorage)
 */
router.post('/bulk', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { trips } = req.body;
        if (!Array.isArray(trips)) {
            return res.status(400).json({ error: 'trips must be an array' });
        }
        const created = yield prisma.$transaction(trips.map(trip => prisma.trip.create({
            data: {
                name: trip.name,
                date: new Date(trip.date || trip.createdAt || new Date()),
                assignedOperatorId: trip.assignedOperatorId || null,
                vehicleId: trip.vehicleId || null,
                vehicleName: trip.vehicleName || null,
                notes: trip.notes || null,
                status: trip.status || 'planned'
            }
        })));
        res.status(201).json({
            success: true,
            count: created.length,
            message: `${created.length} trips imported`
        });
    }
    catch (error) {
        console.error('Error bulk importing trips:', error);
        res.status(500).json({ error: error.message });
    }
}));
exports.default = router;
