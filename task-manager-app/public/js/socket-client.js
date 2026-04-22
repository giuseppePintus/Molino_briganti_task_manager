/**
 * Socket.io Client per aggiornamenti in tempo reale
 * Include questo file nelle pagine HTML che devono ricevere aggiornamenti live
 */

class SocketClient {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.connected = false;
        this.eventHandlers = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    /**
     * Connetti al server WebSocket
     */
    connect() {
        // Determina l'URL del server
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        // Socket.io gestisce automaticamente il trasporto
        this.socket = io(window.location.origin, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
            console.log('🔌 WebSocket connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            
            // Registra utente se abbiamo un token
            this.registerUser();
            
            // Chiama handler personalizzato
            if (this.eventHandlers['connect']) {
                this.eventHandlers['connect']();
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔌 WebSocket disconnected:', reason);
            this.connected = false;
            
            if (this.eventHandlers['disconnect']) {
                this.eventHandlers['disconnect'](reason);
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ WebSocket connection error:', error);
            this.reconnectAttempts++;
        });

        // Registra handler per eventi task
        this.socket.on('task:created', (data) => this.handleEvent('task:created', data));
        this.socket.on('task:updated', (data) => this.handleEvent('task:updated', data));
        this.socket.on('task:deleted', (data) => this.handleEvent('task:deleted', data));
        this.socket.on('task:assigned', (data) => this.handleEvent('task:assigned', data));

        // Registra handler per eventi order
        this.socket.on('order:created', (data) => this.handleEvent('order:created', data));
        this.socket.on('order:updated', (data) => this.handleEvent('order:updated', data));
        this.socket.on('order:assigned', (data) => this.handleEvent('order:assigned', data));
        this.socket.on('order:statusChanged', (data) => this.handleEvent('order:statusChanged', data));

        // Registra handler per eventi trip
        this.socket.on('trip:created', (data) => this.handleEvent('trip:created', data));
        this.socket.on('trip:updated', (data) => this.handleEvent('trip:updated', data));

        // Registra handler per eventi inventory
        this.socket.on('inventory:updated', (data) => this.handleEvent('inventory:updated', data));

        // Refresh generico
        this.socket.on('refresh:data', (data) => this.handleEvent('refresh:data', data));
    }

    /**
     * Registra l'utente corrente con il server
     */
    registerUser() {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                // Decodifica il token JWT per ottenere l'userId
                const payload = JSON.parse(atob(token.split('.')[1]));
                this.userId = payload.userId || payload.id;
                
                if (this.userId && this.socket) {
                    this.socket.emit('register', this.userId);
                    console.log(`👤 Registered as user ${this.userId}`);
                }
            }
        } catch (error) {
            console.warn('Could not register user:', error);
        }
    }

    /**
     * Gestisce un evento ricevuto
     */
    handleEvent(eventType, data) {
        console.log(`📨 Received event: ${eventType}`, data);
        
        if (this.eventHandlers[eventType]) {
            this.eventHandlers[eventType](data);
        }
        
        // Chiama anche handler generico se esiste
        if (this.eventHandlers['*']) {
            this.eventHandlers['*'](eventType, data);
        }
    }

    /**
     * Registra un handler per un tipo di evento
     */
    on(eventType, handler) {
        this.eventHandlers[eventType] = handler;
    }

    /**
     * Rimuovi un handler
     */
    off(eventType) {
        delete this.eventHandlers[eventType];
    }

    /**
     * Disconnetti dal server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }

    /**
     * Verifica se è connesso
     */
    isConnected() {
        return this.connected;
    }
}

// Crea istanza globale
const socketClient = new SocketClient();

// Helpers per refresh automatico
const LiveUpdates = {
    /**
     * Inizializza gli aggiornamenti live per una pagina
     * @param {Object} options - Opzioni di configurazione
     * @param {Function} options.onTaskChange - Callback quando un task cambia
     * @param {Function} options.onOrderChange - Callback quando un ordine cambia
     * @param {Function} options.onRefresh - Callback per refresh generico
     */
    init(options = {}) {
        socketClient.connect();

        // Task events
        if (options.onTaskChange) {
            socketClient.on('task:created', (data) => options.onTaskChange('created', data.task));
            socketClient.on('task:updated', (data) => options.onTaskChange('updated', data.task));
            socketClient.on('task:deleted', (data) => options.onTaskChange('deleted', { id: data.taskId }));
            socketClient.on('task:assigned', (data) => options.onTaskChange('assigned', data.task));
        }

        // Order events
        if (options.onOrderChange) {
            socketClient.on('order:created', (data) => options.onOrderChange('created', data.order));
            socketClient.on('order:updated', (data) => options.onOrderChange('updated', data.order));
            socketClient.on('order:assigned', (data) => options.onOrderChange('assigned', data.order));
            socketClient.on('order:statusChanged', (data) => options.onOrderChange('statusChanged', data.order));
        }

        // Trip events
        if (options.onTripChange) {
            socketClient.on('trip:created', (data) => options.onTripChange('created', data.trip));
            socketClient.on('trip:updated', (data) => options.onTripChange('updated', data.trip));
        }

        // Generic refresh
        if (options.onRefresh) {
            socketClient.on('refresh:data', (data) => options.onRefresh(data.dataType));
        }

        // Connection status
        if (options.onConnect) {
            socketClient.on('connect', options.onConnect);
        }
        if (options.onDisconnect) {
            socketClient.on('disconnect', options.onDisconnect);
        }

        console.log('✅ Live updates initialized');
    },

    /**
     * Disconnetti
     */
    disconnect() {
        socketClient.disconnect();
    }
};
