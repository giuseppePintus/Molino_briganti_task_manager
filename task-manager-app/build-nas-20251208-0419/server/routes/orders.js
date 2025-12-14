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
const socketService_1 = require("../services/socketService");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
/**
 * GET /api/orders
 * Lista tutti gli ordini
 */
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { type, status, from, to } = req.query;
        const where = {};
        if (type)
            where.type = type;
        if (status)
            where.status = status;
        // Filtro date
        if (from || to) {
            where.dateTime = {};
            if (from)
                where.dateTime.gte = new Date(from);
            if (to)
                where.dateTime.lte = new Date(to);
        }
        const orders = yield prisma.order.findMany({
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
            }
            catch (parseError) {
                console.warn(`Warning: Invalid products JSON for order ${order.id}:`, order.products);
                products = [];
            }
            return Object.assign(Object.assign({}, order), { products });
        });
        res.json(ordersWithProducts);
    }
    catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * GET /api/orders/:id
 * Ottieni singolo ordine
 */
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const order = yield prisma.order.findUnique({
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
        }
        catch (parseError) {
            console.warn(`Warning: Invalid products JSON for order ${order.id}:`, order.products);
            products = [];
        }
        res.json(Object.assign(Object.assign({}, order), { products }));
    }
    catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * POST /api/orders
 * Crea nuovo ordine
 */
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { type, customerId, clientName, client, // Alias per clientName (compatibilità frontend)
        products, tripId, assignedOperatorId, dateTime, notes } = req.body;
        // Accetta sia clientName che client (alias)
        const clientNameValue = clientName || client || null;
        const order = yield prisma.order.create({
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
        }
        catch (parseError) {
            console.warn(`Warning: Invalid products JSON for order ${order.id}:`, order.products);
            parsedProducts = [];
        }
        const orderWithProducts = Object.assign(Object.assign({}, order), { products: parsedProducts });
        // Notifica WebSocket
        socketService_1.socketService.notifyOrderCreated(orderWithProducts);
        res.status(201).json(orderWithProducts);
    }
    catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * PUT /api/orders/:id
 * Aggiorna ordine
 */
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { type, customerId, clientName, client, // Alias per clientName (compatibilità frontend)
        products, tripId, assignedOperatorId, dateTime, status, notes } = req.body;
        const updateData = {};
        if (type !== undefined)
            updateData.type = type;
        if (customerId !== undefined)
            updateData.customerId = customerId;
        // Accetta sia clientName che client (alias)
        const clientNameValue = clientName !== undefined ? clientName : client;
        if (clientNameValue !== undefined)
            updateData.clientName = clientNameValue;
        if (products !== undefined)
            updateData.products = JSON.stringify(products);
        if (tripId !== undefined)
            updateData.tripId = tripId;
        // Gestione assegnazione operatore con timestamp
        if (assignedOperatorId !== undefined) {
            updateData.assignedOperatorId = assignedOperatorId;
            // Se viene assegnato un operatore, salva la data di assegnazione
            if (assignedOperatorId && assignedOperatorId !== null) {
                // Leggi l'ordine corrente per vedere se era già assegnato
                const currentOrder = yield prisma.order.findUnique({ where: { id: parseInt(id) } });
                if (!(currentOrder === null || currentOrder === void 0 ? void 0 : currentOrder.assignedOperatorId)) {
                    updateData.assignedAt = new Date();
                }
            }
        }
        if (dateTime !== undefined)
            updateData.dateTime = dateTime ? new Date(dateTime) : null;
        if (status !== undefined) {
            updateData.status = status;
            if (status === 'completed') {
                updateData.completedAt = new Date();
            }
            // Se lo status passa a in_progress (accettato), salva acceptedAt
            if (status === 'in_progress') {
                const currentOrder = yield prisma.order.findUnique({ where: { id: parseInt(id) } });
                if (!(currentOrder === null || currentOrder === void 0 ? void 0 : currentOrder.acceptedAt)) {
                    updateData.acceptedAt = new Date();
                }
            }
        }
        if (notes !== undefined)
            updateData.notes = notes;
        const order = yield prisma.order.update({
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
        }
        catch (parseError) {
            console.warn(`Warning: Invalid products JSON for order ${order.id}:`, order.products);
            parsedProducts = [];
        }
        const orderWithProducts = Object.assign(Object.assign({}, order), { products: parsedProducts });
        // Notifica WebSocket (distinguo se è cambio status o update generico)
        if (status !== undefined) {
            socketService_1.socketService.notifyOrderStatusChanged(orderWithProducts);
        }
        else {
            socketService_1.socketService.notifyOrderUpdated(orderWithProducts);
        }
        res.json(orderWithProducts);
    }
    catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * DELETE /api/orders/:id
 * Elimina ordine
 */
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma.order.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true, message: 'Order deleted' });
    }
    catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * POST /api/orders/bulk
 * Importa ordini in blocco (per migrazione da localStorage)
 */
router.post('/bulk', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { orders } = req.body;
        if (!Array.isArray(orders)) {
            return res.status(400).json({ error: 'orders must be an array' });
        }
        const created = yield prisma.$transaction(orders.map(order => prisma.order.create({
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
        })));
        res.status(201).json({
            success: true,
            count: created.length,
            message: `${created.length} orders imported`
        });
    }
    catch (error) {
        console.error('Error bulk importing orders:', error);
        res.status(500).json({ error: error.message });
    }
}));
exports.default = router;
