import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Tipi di eventi
export enum SocketEvents {
  // Task events
  TASK_CREATED = 'task:created',
  TASK_UPDATED = 'task:updated',
  TASK_DELETED = 'task:deleted',
  TASK_ASSIGNED = 'task:assigned',
  
  // Order events
  ORDER_CREATED = 'order:created',
  ORDER_UPDATED = 'order:updated',
  ORDER_ASSIGNED = 'order:assigned',
  ORDER_STATUS_CHANGED = 'order:statusChanged',
  
  // Trip events
  TRIP_CREATED = 'trip:created',
  TRIP_UPDATED = 'trip:updated',
  
  // Inventory events
  INVENTORY_UPDATED = 'inventory:updated',
  
  // Generic refresh
  REFRESH_DATA = 'refresh:data'
}

// Interfaccia per i dati dell'evento
export interface SocketEventData {
  type: string;
  payload: any;
  targetUsers?: number[];  // Se specificato, solo questi utenti ricevono l'evento
  excludeSocket?: string;  // Socket ID da escludere (il mittente)
}

class SocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<number, Set<string>> = new Map(); // userId -> Set<socketId>
  
  /**
   * Inizializza il server WebSocket
   */
  initialize(httpServer: HttpServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });
    
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      
      // L'utente si registra con il proprio userId
      socket.on('register', (userId: number) => {
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
  private registerUser(userId: number, socketId: string): void {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
  }
  
  /**
   * Rimuovi un socket dalla registrazione
   */
  private unregisterSocket(socketId: string): void {
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
  private getUserSockets(userId: number): string[] {
    return Array.from(this.connectedUsers.get(userId) || []);
  }
  
  /**
   * Emetti un evento a tutti i client connessi
   */
  broadcast(event: SocketEvents, data: any, excludeSocket?: string): void {
    if (!this.io) return;
    
    if (excludeSocket) {
      this.io.sockets.sockets.forEach((socket) => {
        if (socket.id !== excludeSocket) {
          socket.emit(event, data);
        }
      });
    } else {
      this.io.emit(event, data);
    }
  }
  
  /**
   * Emetti un evento a utenti specifici
   */
  emitToUsers(event: SocketEvents, data: any, userIds: number[]): void {
    if (!this.io) return;
    
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
  emitToUser(event: SocketEvents, data: any, userId: number): void {
    this.emitToUsers(event, data, [userId]);
  }
  
  /**
   * Notifica creazione task
   */
  notifyTaskCreated(task: any, excludeSocket?: string): void {
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
  notifyTaskUpdated(task: any, excludeSocket?: string): void {
    this.broadcast(SocketEvents.TASK_UPDATED, { task }, excludeSocket);
    
    // Se il task ha un assignee, notifica anche lui
    if (task.assignedToId) {
      this.emitToUser(SocketEvents.TASK_ASSIGNED, { task }, task.assignedToId);
    }
  }
  
  /**
   * Notifica eliminazione task
   */
  notifyTaskDeleted(taskId: number, excludeSocket?: string): void {
    this.broadcast(SocketEvents.TASK_DELETED, { taskId }, excludeSocket);
  }
  
  /**
   * Notifica creazione ordine
   */
  notifyOrderCreated(order: any, excludeSocket?: string): void {
    this.broadcast(SocketEvents.ORDER_CREATED, { order }, excludeSocket);
  }
  
  /**
   * Notifica aggiornamento ordine
   */
  notifyOrderUpdated(order: any, excludeSocket?: string): void {
    this.broadcast(SocketEvents.ORDER_UPDATED, { order }, excludeSocket);
    
    // Se l'ordine è assegnato, notifica l'operatore
    if (order.assignedToId) {
      this.emitToUser(SocketEvents.ORDER_ASSIGNED, { order }, order.assignedToId);
    }
  }
  
  /**
   * Notifica cambio stato ordine
   */
  notifyOrderStatusChanged(order: any, excludeSocket?: string): void {
    this.broadcast(SocketEvents.ORDER_STATUS_CHANGED, { order }, excludeSocket);
    
    if (order.assignedToId) {
      this.emitToUser(SocketEvents.ORDER_STATUS_CHANGED, { order }, order.assignedToId);
    }
  }
  
  /**
   * Notifica creazione viaggio
   */
  notifyTripCreated(trip: any, excludeSocket?: string): void {
    this.broadcast(SocketEvents.TRIP_CREATED, { trip }, excludeSocket);
  }
  
  /**
   * Notifica aggiornamento viaggio
   */
  notifyTripUpdated(trip: any, excludeSocket?: string): void {
    this.broadcast(SocketEvents.TRIP_UPDATED, { trip }, excludeSocket);
  }
  
  /**
   * Notifica aggiornamento inventario
   */
  notifyInventoryUpdated(excludeSocket?: string): void {
    this.broadcast(SocketEvents.INVENTORY_UPDATED, {}, excludeSocket);
  }
  
  /**
   * Richiedi refresh generale dei dati
   */
  requestDataRefresh(dataType?: string, excludeSocket?: string): void {
    this.broadcast(SocketEvents.REFRESH_DATA, { dataType }, excludeSocket);
  }
  
  /**
   * Ottieni statistiche delle connessioni
   */
  getConnectionStats(): { totalConnections: number; connectedUsers: number } {
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
export const socketService = new SocketService();
export default socketService;
