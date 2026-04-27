/**
 * DataSync - Servizio per sincronizzare dati tra localStorage e API
 * 
 * Questo modulo gestisce:
 * - Ordini (consegne/ritiri)
 * - Viaggi
 * - Clienti  
 * - Impostazioni aziendali
 * 
 * Mantiene compatibilità con localStorage come cache/fallback
 */

(function() {
  const API_URL = window.API_URL || `http://${window.location.hostname}:${window.location.port || 5000}/api`;
  
  function getToken() {
    return localStorage.getItem('token');
  }
  
  function getHeaders() {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  // ============================================
  // ORDERS API
  // ============================================
  
  const OrdersAPI = {
    /**
     * Carica tutti gli ordini dal server
     */
    async getAll(filters = {}) {
      try {
        const params = new URLSearchParams();
        if (filters.type) params.append('type', filters.type);
        if (filters.status) params.append('status', filters.status);
        if (filters.from) params.append('from', filters.from);
        if (filters.to) params.append('to', filters.to);
        
        const url = `${API_URL}/orders${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, { headers: getHeaders() });
        
        if (response.ok) {
          const orders = await response.json();
          // Cache in localStorage
          localStorage.setItem('orders', JSON.stringify(orders));
          return orders;
        }
        throw new Error('Failed to fetch orders');
      } catch (error) {
        console.warn('⚠️ OrdersAPI.getAll fallback to localStorage:', error.message);
        return JSON.parse(localStorage.getItem('orders') || '[]');
      }
    },
    
    /**
     * Crea nuovo ordine
     */
    async create(orderData) {
      try {
        const response = await fetch(`${API_URL}/orders`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(orderData)
        });
        
        if (response.ok) {
          const order = await response.json();
          // Aggiorna cache
          const cached = JSON.parse(localStorage.getItem('orders') || '[]');
          cached.push(order);
          localStorage.setItem('orders', JSON.stringify(cached));
          return order;
        }
        throw new Error('Failed to create order');
      } catch (error) {
        console.warn('⚠️ OrdersAPI.create fallback to localStorage:', error.message);
        // Fallback: crea localmente
        const cached = JSON.parse(localStorage.getItem('orders') || '[]');
        const newOrder = {
          id: Date.now(),
          ...orderData,
          createdAt: new Date().toISOString(),
          _pendingSync: true
        };
        cached.push(newOrder);
        localStorage.setItem('orders', JSON.stringify(cached));
        return newOrder;
      }
    },
    
    /**
     * Aggiorna ordine
     */
    async update(id, updates) {
      try {
        const response = await fetch(`${API_URL}/orders/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(updates)
        });
        
        if (response.ok) {
          const order = await response.json();
          // Aggiorna cache
          const cached = JSON.parse(localStorage.getItem('orders') || '[]');
          const idx = cached.findIndex(o => o.id === id);
          if (idx >= 0) cached[idx] = order;
          localStorage.setItem('orders', JSON.stringify(cached));
          return order;
        }
        throw new Error('Failed to update order');
      } catch (error) {
        console.warn('⚠️ OrdersAPI.update fallback to localStorage:', error.message);
        const cached = JSON.parse(localStorage.getItem('orders') || '[]');
        const idx = cached.findIndex(o => o.id === id);
        if (idx >= 0) {
          cached[idx] = { ...cached[idx], ...updates, _pendingSync: true };
          localStorage.setItem('orders', JSON.stringify(cached));
          return cached[idx];
        }
        return null;
      }
    },
    
    /**
     * Elimina ordine
     */
    async delete(id) {
      try {
        const response = await fetch(`${API_URL}/orders/${id}`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        
        if (response.ok) {
          // Rimuovi da cache
          const cached = JSON.parse(localStorage.getItem('orders') || '[]');
          const filtered = cached.filter(o => o.id !== id);
          localStorage.setItem('orders', JSON.stringify(filtered));
          return true;
        }
        throw new Error('Failed to delete order');
      } catch (error) {
        console.warn('⚠️ OrdersAPI.delete fallback to localStorage:', error.message);
        const cached = JSON.parse(localStorage.getItem('orders') || '[]');
        const filtered = cached.filter(o => o.id !== id);
        localStorage.setItem('orders', JSON.stringify(filtered));
        return true;
      }
    },
    
    /**
     * Importa ordini in blocco (migrazione da localStorage)
     */
    async bulkImport(orders) {
      try {
        const response = await fetch(`${API_URL}/orders/bulk`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ orders })
        });
        
        if (response.ok) {
          return await response.json();
        }
        throw new Error('Failed to bulk import orders');
      } catch (error) {
        console.error('❌ OrdersAPI.bulkImport failed:', error.message);
        throw error;
      }
    }
  };

  // ============================================
  // TRIPS API
  // ============================================
  
  const TripsAPI = {
    /**
     * Carica tutti i viaggi dal server
     */
    async getAll(filters = {}) {
      try {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.from) params.append('from', filters.from);
        if (filters.to) params.append('to', filters.to);
        if (filters.operatorId) params.append('operatorId', filters.operatorId);
        
        const url = `${API_URL}/trips${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, { headers: getHeaders() });
        
        if (response.ok) {
          const trips = await response.json();
          localStorage.setItem('trips', JSON.stringify(trips));
          return trips;
        }
        throw new Error('Failed to fetch trips');
      } catch (error) {
        console.warn('⚠️ TripsAPI.getAll fallback to localStorage:', error.message);
        return JSON.parse(localStorage.getItem('trips') || '[]');
      }
    },
    
    /**
     * Crea nuovo viaggio
     */
    async create(tripData) {
      try {
        const response = await fetch(`${API_URL}/trips`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(tripData)
        });
        
        if (response.ok) {
          const trip = await response.json();
          const cached = JSON.parse(localStorage.getItem('trips') || '[]');
          cached.push(trip);
          localStorage.setItem('trips', JSON.stringify(cached));
          return trip;
        }
        throw new Error('Failed to create trip');
      } catch (error) {
        console.warn('⚠️ TripsAPI.create fallback to localStorage:', error.message);
        const cached = JSON.parse(localStorage.getItem('trips') || '[]');
        const newTrip = {
          id: Date.now(),
          ...tripData,
          createdAt: new Date().toISOString(),
          _pendingSync: true
        };
        cached.push(newTrip);
        localStorage.setItem('trips', JSON.stringify(cached));
        return newTrip;
      }
    },
    
    /**
     * Aggiorna viaggio
     */
    async update(id, updates) {
      try {
        const response = await fetch(`${API_URL}/trips/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(updates)
        });
        
        if (response.ok) {
          const trip = await response.json();
          const cached = JSON.parse(localStorage.getItem('trips') || '[]');
          const idx = cached.findIndex(t => t.id === id);
          if (idx >= 0) cached[idx] = trip;
          localStorage.setItem('trips', JSON.stringify(cached));
          return trip;
        }
        throw new Error('Failed to update trip');
      } catch (error) {
        console.warn('⚠️ TripsAPI.update fallback to localStorage:', error.message);
        const cached = JSON.parse(localStorage.getItem('trips') || '[]');
        const idx = cached.findIndex(t => t.id === id);
        if (idx >= 0) {
          cached[idx] = { ...cached[idx], ...updates, _pendingSync: true };
          localStorage.setItem('trips', JSON.stringify(cached));
          return cached[idx];
        }
        return null;
      }
    },
    
    /**
     * Elimina viaggio
     */
    async delete(id) {
      try {
        const response = await fetch(`${API_URL}/trips/${id}`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        
        if (response.ok) {
          const cached = JSON.parse(localStorage.getItem('trips') || '[]');
          const filtered = cached.filter(t => t.id !== id);
          localStorage.setItem('trips', JSON.stringify(filtered));
          return true;
        }
        throw new Error('Failed to delete trip');
      } catch (error) {
        console.warn('⚠️ TripsAPI.delete fallback to localStorage:', error.message);
        const cached = JSON.parse(localStorage.getItem('trips') || '[]');
        const filtered = cached.filter(t => t.id !== id);
        localStorage.setItem('trips', JSON.stringify(filtered));
        return true;
      }
    },
    
    /**
     * Aggiungi ordini a un viaggio
     */
    async addOrders(tripId, orderIds) {
      try {
        const response = await fetch(`${API_URL}/trips/${tripId}/orders`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ orderIds })
        });
        
        if (response.ok) {
          return await response.json();
        }
        throw new Error('Failed to add orders to trip');
      } catch (error) {
        console.warn('⚠️ TripsAPI.addOrders fallback to localStorage:', error.message);
        // Fallback locale
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        orderIds.forEach(orderId => {
          const order = orders.find(o => o.id === orderId);
          if (order) order.tripId = tripId;
        });
        localStorage.setItem('orders', JSON.stringify(orders));
        return { success: true };
      }
    },
    
    /**
     * Importa viaggi in blocco
     */
    async bulkImport(trips) {
      try {
        const response = await fetch(`${API_URL}/trips/bulk`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ trips })
        });
        
        if (response.ok) {
          return await response.json();
        }
        throw new Error('Failed to bulk import trips');
      } catch (error) {
        console.error('❌ TripsAPI.bulkImport failed:', error.message);
        throw error;
      }
    }
  };

  // ============================================
  // CUSTOMERS API
  // ============================================
  
  const CustomersAPI = {
    /**
     * Carica tutti i clienti dal server
     */
    async getAll(filters = {}) {
      try {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.active !== undefined) params.append('active', filters.active);
        
        const url = `${API_URL}/customers${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, { headers: getHeaders() });
        
        if (response.ok) {
          const customers = await response.json();
          localStorage.setItem('customers', JSON.stringify(customers));
          return customers;
        }
        throw new Error('Failed to fetch customers');
      } catch (error) {
        console.warn('⚠️ CustomersAPI.getAll fallback to localStorage:', error.message);
        return JSON.parse(localStorage.getItem('customers') || '[]');
      }
    },
    
    /**
     * Crea nuovo cliente
     */
    async create(customerData) {
      try {
        const response = await fetch(`${API_URL}/customers`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(customerData)
        });
        
        if (response.status === 409) {
          const data = await response.json();
          const err = new Error(data.error || 'Ragione sociale già esistente');
          err.status = 409;
          err.code = data.code;
          throw err;
        }
        
        if (response.ok) {
          const customer = await response.json();
          const cached = JSON.parse(localStorage.getItem('customers') || '[]');
          cached.push(customer);
          localStorage.setItem('customers', JSON.stringify(cached));
          return customer;
        }
        throw new Error('Failed to create customer');
      } catch (error) {
        if (error.status === 409) throw error;
        console.warn('⚠️ CustomersAPI.create fallback to localStorage:', error.message);
        const cached = JSON.parse(localStorage.getItem('customers') || '[]');
        const newCustomer = {
          id: Date.now(),
          ...customerData,
          createdAt: new Date().toISOString(),
          _pendingSync: true
        };
        cached.push(newCustomer);
        localStorage.setItem('customers', JSON.stringify(cached));
        return newCustomer;
      }
    },
    
    /**
     * Aggiorna cliente
     */
    async update(id, updates) {
      try {
        const response = await fetch(`${API_URL}/customers/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(updates)
        });
        
        if (response.status === 409) {
          const data = await response.json();
          const err = new Error(data.error || 'Ragione sociale già esistente');
          err.status = 409;
          err.code = data.code;
          throw err;
        }
        
        if (response.ok) {
          const customer = await response.json();
          const cached = JSON.parse(localStorage.getItem('customers') || '[]');
          const idx = cached.findIndex(c => c.id === id);
          if (idx >= 0) cached[idx] = customer;
          localStorage.setItem('customers', JSON.stringify(cached));
          return customer;
        }
        throw new Error('Failed to update customer');
      } catch (error) {
        if (error.status === 409) throw error;
        console.warn('⚠️ CustomersAPI.update fallback to localStorage:', error.message);
        const cached = JSON.parse(localStorage.getItem('customers') || '[]');
        const idx = cached.findIndex(c => c.id === id);
        if (idx >= 0) {
          cached[idx] = { ...cached[idx], ...updates, _pendingSync: true };
          localStorage.setItem('customers', JSON.stringify(cached));
          return cached[idx];
        }
        return null;
      }
    },
    
    /**
     * Elimina cliente
     */
    async delete(id, hard = true) {
      try {
        const response = await fetch(`${API_URL}/customers/${id}?hard=${hard}`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        
        if (response.ok) {
          const cached = JSON.parse(localStorage.getItem('customers') || '[]');
          const filtered = cached.filter(c => c.id !== id);
          localStorage.setItem('customers', JSON.stringify(filtered));
          return true;
        }
        throw new Error('Failed to delete customer');
      } catch (error) {
        console.warn('⚠️ CustomersAPI.delete fallback to localStorage:', error.message);
        const cached = JSON.parse(localStorage.getItem('customers') || '[]');
        const filtered = cached.filter(c => c.id !== id);
        localStorage.setItem('customers', JSON.stringify(filtered));
        return true;
      }
    },
    
    /**
     * Importa clienti da CSV
     */
    async importFromCsv() {
      try {
        const response = await fetch(`${API_URL}/customers/import-csv`, {
          method: 'POST',
          headers: getHeaders()
        });
        
        if (response.ok) {
          return await response.json();
        }
        throw new Error('Failed to import customers from CSV');
      } catch (error) {
        console.error('❌ CustomersAPI.importFromCsv failed:', error.message);
        throw error;
      }
    }
  };

  // ============================================
  // SETTINGS API
  // ============================================
  
  const SettingsAPI = {
    /**
     * Carica impostazioni aziendali dal server
     */
    async get() {
      try {
        const response = await fetch(`${API_URL}/settings/company`, {
          headers: getHeaders()
        });
        
        if (response.ok) {
          const settings = await response.json();
          localStorage.setItem('companySettings', JSON.stringify(settings));
          return settings;
        }
        throw new Error('Failed to fetch settings');
      } catch (error) {
        console.warn('⚠️ SettingsAPI.get fallback to localStorage:', error.message);
        return JSON.parse(localStorage.getItem('companySettings') || '{}');
      }
    },
    
    /**
     * Salva impostazioni aziendali sul server
     */
    async save(settings) {
      try {
        const response = await fetch(`${API_URL}/settings/company`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(settings)
        });
        
        if (response.ok) {
          localStorage.setItem('companySettings', JSON.stringify(settings));
          return await response.json();
        }
        throw new Error('Failed to save settings');
      } catch (error) {
        console.warn('⚠️ SettingsAPI.save fallback to localStorage:', error.message);
        localStorage.setItem('companySettings', JSON.stringify(settings));
        return { success: true, _savedLocally: true };
      }
    },
    
    /**
     * Carica veicoli
     */
    async getVehicles() {
      try {
        const response = await fetch(`${API_URL}/settings/vehicles`, {
          headers: getHeaders()
        });
        
        if (response.ok) {
          return await response.json();
        }
        throw new Error('Failed to fetch vehicles');
      } catch (error) {
        console.warn('⚠️ SettingsAPI.getVehicles fallback:', error.message);
        const settings = JSON.parse(localStorage.getItem('companySettings') || '{}');
        return settings.vehicles || [];
      }
    },
    
    /**
     * Carica festivi
     */
    async getHolidays() {
      try {
        const response = await fetch(`${API_URL}/settings/holidays`, {
          headers: getHeaders()
        });
        
        if (response.ok) {
          return await response.json();
        }
        throw new Error('Failed to fetch holidays');
      } catch (error) {
        console.warn('⚠️ SettingsAPI.getHolidays fallback:', error.message);
        const settings = JSON.parse(localStorage.getItem('companySettings') || '{}');
        return settings.holidays || [];
      }
    }
  };

  // ============================================
  // DATA SYNC - Sincronizzazione automatica
  // ============================================
  
  const DataSync = {
    /**
     * Sincronizza tutti i dati pendenti con il server
     */
    async syncPendingData() {
      console.log('🔄 Syncing pending data...');
      
      // Ordini pendenti
      const orders = JSON.parse(localStorage.getItem('orders') || '[]');
      const pendingOrders = orders.filter(o => o._pendingSync);
      
      for (const order of pendingOrders) {
        try {
          if (order.id > 1000000000) { // ID temporaneo (timestamp)
            const { id, _pendingSync, ...data } = order;
            await OrdersAPI.create(data);
          } else {
            const { _pendingSync, ...data } = order;
            await OrdersAPI.update(order.id, data);
          }
        } catch (e) {
          console.warn('⚠️ Failed to sync order:', order.id);
        }
      }
      
      // Viaggi pendenti
      const trips = JSON.parse(localStorage.getItem('trips') || '[]');
      const pendingTrips = trips.filter(t => t._pendingSync);
      
      for (const trip of pendingTrips) {
        try {
          if (trip.id > 1000000000) {
            const { id, _pendingSync, ...data } = trip;
            await TripsAPI.create(data);
          } else {
            const { _pendingSync, ...data } = trip;
            await TripsAPI.update(trip.id, data);
          }
        } catch (e) {
          console.warn('⚠️ Failed to sync trip:', trip.id);
        }
      }
      
      console.log('✅ Data sync complete');
    },
    
    /**
     * Migra dati da localStorage al database
     */
    async migrateFromLocalStorage() {
      console.log('📦 Starting migration from localStorage...');
      
      const results = {
        orders: { success: 0, failed: 0 },
        trips: { success: 0, failed: 0 },
        settings: false
      };
      
      // Migra ordini
      const orders = JSON.parse(localStorage.getItem('orders') || '[]');
      if (orders.length > 0) {
        try {
          const result = await OrdersAPI.bulkImport(orders);
          results.orders.success = result.count || orders.length;
          console.log(`✅ Migrated ${results.orders.success} orders`);
        } catch (e) {
          results.orders.failed = orders.length;
          console.error('❌ Failed to migrate orders:', e);
        }
      }
      
      // Migra viaggi
      const trips = JSON.parse(localStorage.getItem('trips') || '[]');
      if (trips.length > 0) {
        try {
          const result = await TripsAPI.bulkImport(trips);
          results.trips.success = result.count || trips.length;
          console.log(`✅ Migrated ${results.trips.success} trips`);
        } catch (e) {
          results.trips.failed = trips.length;
          console.error('❌ Failed to migrate trips:', e);
        }
      }
      
      // Migra impostazioni
      const settings = JSON.parse(localStorage.getItem('companySettings') || '{}');
      if (Object.keys(settings).length > 0) {
        try {
          await SettingsAPI.save(settings);
          results.settings = true;
          console.log('✅ Migrated settings');
        } catch (e) {
          console.error('❌ Failed to migrate settings:', e);
        }
      }
      
      console.log('📦 Migration complete:', results);
      return results;
    },
    
    /**
     * Inizializza sync automatico
     */
    init() {
      // Sync ogni 5 minuti
      setInterval(() => this.syncPendingData(), 5 * 60 * 1000);
      
      // Sync quando torna online
      window.addEventListener('online', () => {
        console.log('🌐 Back online, syncing...');
        this.syncPendingData();
      });
    }
  };

  // Esporta globalmente
  window.DataSync = {
    Orders: OrdersAPI,
    Trips: TripsAPI,
    Customers: CustomersAPI,
    Settings: SettingsAPI,
    sync: DataSync.syncPendingData.bind(DataSync),
    migrate: DataSync.migrateFromLocalStorage.bind(DataSync),
    init: DataSync.init.bind(DataSync),
    // Alias per compatibilità con vecchio codice
    loadOrders: () => OrdersAPI.getAll(),
    loadTrips: () => TripsAPI.getAll(),
    loadCustomers: () => CustomersAPI.getAll(),
    loadSettings: () => SettingsAPI.get(),
    saveOrder: (data) => OrdersAPI.create(data),
    updateOrder: (id, data) => OrdersAPI.update(id, data),
    deleteOrder: (id) => OrdersAPI.delete(id),
    saveTrip: (data) => TripsAPI.create(data),
    updateTrip: (id, data) => TripsAPI.update(id, data),
    deleteTrip: (id) => TripsAPI.delete(id),
    saveCustomer: (data) => CustomersAPI.create(data),
    updateCustomer: (id, data) => CustomersAPI.update(id, data),
    deleteCustomer: (id) => CustomersAPI.delete(id),
    saveSettings: (data) => SettingsAPI.save(data)
  };

  // Inizializza automaticamente
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DataSync.init());
  } else {
    DataSync.init();
  }

  console.log('✅ DataSync module loaded');
})();
