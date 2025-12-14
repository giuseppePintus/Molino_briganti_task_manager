"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketService = exports.SocketEvents = void 0;
const socket_io_1 = require("socket.io");
// Tipi di eventi
var SocketEvents;
(function (SocketEvents) {
    // Task events
    SocketEvents["TASK_CREATED"] = "task:created";
    SocketEvents["TASK_UPDATED"] = "task:updated";
    SocketEvents["TASK_DELETED"] = "task:deleted";
    SocketEvents["TASK_ASSIGNED"] = "task:assigned";
    // Order events
    SocketEvents["ORDER_CREATED"] = "order:created";
    SocketEvents["ORDER_UPDATED"] = "order:updated";
    SocketEvents["ORDER_ASSIGNED"] = "order:assigned";
    SocketEvents["ORDER_STATUS_CHANGED"] = "order:statusChanged";
    // Trip events
    SocketEvents["TRIP_CREATED"] = "trip:created";
    SocketEvents["TRIP_UPDATED"] = "trip:updated";
    // Inventory events
    SocketEvents["INVENTORY_UPDATED"] = "inventory:updated";
    // Generic refresh
    SocketEvents["REFRESH_DATA"] = "refresh:data";
})(SocketEvents || (exports.SocketEvents = SocketEvents = {}));
class SocketService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map(); // userId -> Set<socketId>
    }
    /**
     * Inizializza il server WebSocket
     */
    initialize(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });
        this.io.on('connection', (socket) => {
            console.log(`🔌 Client connected: ${socket.id}`);
            // L'utente si registra con il proprio userId
            socket.on('register', (userId) => {
                this.registerUser(userId, socket.id);
                console.log(`👤 User ${userId} registered with socket ${socket.id}`);
            });
            // Disconnessione
            socket.on('disconnect', () => {
                this.unregisterSocket(socket.id);
                console.log(`🔌 Client disconnected: ${socket.id}`);
            });
        });
        console.log('🔌 WebSocket server initialized');
        return this.io;
    }
    /**
     * Registra un utente con il suo socket
     */
    registerUser(userId, socketId) {
        if (!this.connectedUsers.has(userId)) {
            this.connectedUsers.set(userId, new Set());
        }
        this.connectedUsers.get(userId).add(socketId);
    }
    /**
     * Rimuovi un socket dalla registrazione
     */
    unregisterSocket(socketId) {
        for (const [userId, sockets] of this.connectedUsers.entries()) {
            if (sockets.has(socketId)) {
                sockets.delete(socketId);
                if (sockets.size === 0) {
                    this.connectedUsers.delete(userId);
                }
                break;
            }
        }
    }
    /**
     * Ottieni i socket di un utente specifico
     */
    getUserSockets(userId) {
        return Array.from(this.connectedUsers.get(userId) || []);
    }
    /**
     * Emetti un evento a tutti i client connessi
     */
    broadcast(event, data, excludeSocket) {
        if (!this.io)
            return;
        if (excludeSocket) {
            this.io.sockets.sockets.forEach((socket) => {
                if (socket.id !== excludeSocket) {
                    socket.emit(event, data);
                }
            });
        }
        else {
            this.io.emit(event, data);
        }
    }
    /**
     * Emetti un evento a utenti specifici
     */
    emitToUsers(event, data, userIds) {
        if (!this.io)
            return;
        for (const userId of userIds) {
            const sockets = this.getUserSockets(userId);
            for (const socketId of sockets) {
                this.io.to(socketId).emit(event, data);
            }
        }
    }
    /**
     * Emetti un evento a un singolo utente
     */
    emitToUser(event, data, userId) {
        this.emitToUsers(event, data, [userId]);
    }
    /**
     * Notifica creazione task
     */
    notifyTaskCreated(task, excludeSocket) {
        // Broadcast a tutti gli admin
        this.broadcast(SocketEvents.TASK_CREATED, { task }, excludeSocket);
        // Se il task ha un assignee, notifica anche lui
        if (task.assignedToId) {
            this.emitToUser(SocketEvents.TASK_ASSIGNED, { task }, task.assignedToId);
        }
    }
    /**
     * Notifica aggiornamento task
     */
    notifyTaskUpdated(task, excludeSocket) {
        this.broadcast(SocketEvents.TASK_UPDATED, { task }, excludeSocket);
        // Se il task ha un assignee, notifica anche lui
        if (task.assignedToId) {
            this.emitToUser(SocketEvents.TASK_ASSIGNED, { task }, task.assignedToId);
        }
    }
    /**
     * Notifica eliminazione task
     */
    notifyTaskDeleted(taskId, excludeSocket) {
        this.broadcast(SocketEvents.TASK_DELETED, { taskId }, excludeSocket);
    }
    /**
     * Notifica creazione ordine
     */
    notifyOrderCreated(order, excludeSocket) {
        this.broadcast(SocketEvents.ORDER_CREATED, { order }, excludeSocket);
    }
    /**
     * Notifica aggiornamento ordine
     */
    notifyOrderUpdated(order, excludeSocket) {
        this.broadcast(SocketEvents.ORDER_UPDATED, { order }, excludeSocket);
        // Se l'ordine è assegnato, notifica l'operatore
        if (order.assignedToId) {
            this.emitToUser(SocketEvents.ORDER_ASSIGNED, { order }, order.assignedToId);
        }
    }
    /**
     * Notifica cambio stato ordine
     */
    notifyOrderStatusChanged(order, excludeSocket) {
        this.broadcast(SocketEvents.ORDER_STATUS_CHANGED, { order }, excludeSocket);
        if (order.assignedToId) {
            this.emitToUser(SocketEvents.ORDER_STATUS_CHANGED, { order }, order.assignedToId);
        }
    }
    /**
     * Notifica creazione viaggio
     */
    notifyTripCreated(trip, excludeSocket) {
        this.broadcast(SocketEvents.TRIP_CREATED, { trip }, excludeSocket);
    }
    /**
     * Notifica aggiornamento viaggio
     */
    notifyTripUpdated(trip, excludeSocket) {
        this.broadcast(SocketEvents.TRIP_UPDATED, { trip }, excludeSocket);
    }
    /**
     * Notifica aggiornamento inventario
     */
    notifyInventoryUpdated(excludeSocket) {
        this.broadcast(SocketEvents.INVENTORY_UPDATED, {}, excludeSocket);
    }
    /**
     * Richiedi refresh generale dei dati
     */
    requestDataRefresh(dataType, excludeSocket) {
        this.broadcast(SocketEvents.REFRESH_DATA, { dataType }, excludeSocket);
    }
    /**
     * Ottieni statistiche delle connessioni
     */
    getConnectionStats() {
        let totalConnections = 0;
        for (const sockets of this.connectedUsers.values()) {
            totalConnections += sockets.size;
        }
        return {
            totalConnections,
            connectedUsers: this.connectedUsers.size
        };
    }
}
// Singleton
exports.socketService = new SocketService();
exports.default = exports.socketService;
