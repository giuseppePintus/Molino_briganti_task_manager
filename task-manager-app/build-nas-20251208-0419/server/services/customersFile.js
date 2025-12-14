"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCustomers = loadCustomers;
exports.saveCustomers = saveCustomers;
exports.getCustomerById = getCustomerById;
exports.addCustomer = addCustomer;
exports.updateCustomer = updateCustomer;
exports.deleteCustomer = deleteCustomer;
exports.searchCustomers = searchCustomers;
exports.exportAsCSV = exportAsCSV;
exports.importCustomers = importCustomers;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CUSTOMERS_FILE = '/app/data/customers.json';
/**
 * Assicura che la directory /app/data esista
 */
function ensureDataDir() {
    const dir = path_1.default.dirname(CUSTOMERS_FILE);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created data directory: ${dir}`);
    }
}
/**
 * Carica tutti i clienti dal file JSON
 */
function loadCustomers() {
    try {
        ensureDataDir();
        if (!fs_1.default.existsSync(CUSTOMERS_FILE)) {
            console.log(`ℹ️ Customers file not found at ${CUSTOMERS_FILE}, returning empty array`);
            return [];
        }
        const data = fs_1.default.readFileSync(CUSTOMERS_FILE, 'utf-8');
        const customers = JSON.parse(data);
        console.log(`✅ Loaded ${customers.length} customers from ${CUSTOMERS_FILE}`);
        return customers;
    }
    catch (error) {
        console.error(`❌ Error loading customers from file:`, error);
        return [];
    }
}
/**
 * Salva tutti i clienti nel file JSON
 */
function saveCustomers(customers) {
    try {
        ensureDataDir();
        const data = JSON.stringify(customers, null, 2);
        fs_1.default.writeFileSync(CUSTOMERS_FILE, data, 'utf-8');
        console.log(`✅ Saved ${customers.length} customers to ${CUSTOMERS_FILE}`);
        return true;
    }
    catch (error) {
        console.error(`❌ Error saving customers to file:`, error);
        return false;
    }
}
/**
 * Carica un singolo cliente per ID
 */
function getCustomerById(id) {
    const customers = loadCustomers();
    return customers.find(c => c.id === id) || null;
}
/**
 * Aggiungi un nuovo cliente
 */
function addCustomer(customer) {
    try {
        const customers = loadCustomers();
        // Genera nuovo ID (max id + 1)
        const maxId = customers.length > 0 ? Math.max(...customers.map(c => c.id)) : 0;
        const newId = maxId + 1;
        const newCustomer = Object.assign(Object.assign({ id: newId }, customer), { isActive: customer.isActive !== false, createdAt: new Date(), updatedAt: new Date() });
        customers.push(newCustomer);
        saveCustomers(customers);
        return newCustomer;
    }
    catch (error) {
        console.error('Error adding customer:', error);
        return null;
    }
}
/**
 * Aggiorna un cliente
 */
function updateCustomer(id, updates) {
    try {
        const customers = loadCustomers();
        const index = customers.findIndex(c => c.id === id);
        if (index === -1) {
            return null;
        }
        customers[index] = Object.assign(Object.assign(Object.assign({}, customers[index]), updates), { id, createdAt: customers[index].createdAt, updatedAt: new Date() });
        saveCustomers(customers);
        return customers[index];
    }
    catch (error) {
        console.error('Error updating customer:', error);
        return null;
    }
}
/**
 * Elimina un cliente
 */
function deleteCustomer(id) {
    try {
        const customers = loadCustomers();
        const filtered = customers.filter(c => c.id !== id);
        if (filtered.length === customers.length) {
            // Customer non trovato
            return false;
        }
        saveCustomers(filtered);
        return true;
    }
    catch (error) {
        console.error('Error deleting customer:', error);
        return false;
    }
}
/**
 * Ricerca clienti per name/code/city/email
 */
function searchCustomers(query, activeOnly = false) {
    const customers = loadCustomers();
    const search = query.toLowerCase();
    return customers.filter(c => {
        if (activeOnly && !c.isActive)
            return false;
        return ((c.name && c.name.toLowerCase().includes(search)) ||
            (c.code && c.code.toLowerCase().includes(search)) ||
            (c.city && c.city.toLowerCase().includes(search)) ||
            (c.email && c.email.toLowerCase().includes(search)));
    }).sort((a, b) => a.name.localeCompare(b.name));
}
/**
 * Esporta clienti come CSV
 */
function exportAsCSV() {
    const customers = loadCustomers();
    const headers = [
        'id', 'code', 'name', 'address', 'city', 'province', 'cap',
        'phone', 'email', 'piva', 'cf', 'notes', 'openingTime',
        'closingTime', 'deliveryStartTime', 'deliveryEndTime', 'isActive'
    ];
    const rows = customers.map(c => [
        c.id,
        c.code || '',
        c.name,
        c.address || '',
        c.city || '',
        c.province || '',
        c.cap || '',
        c.phone || '',
        c.email || '',
        c.piva || '',
        c.cf || '',
        c.notes || '',
        c.openingTime || '',
        c.closingTime || '',
        c.deliveryStartTime || '',
        c.deliveryEndTime || '',
        c.isActive ? 'true' : 'false'
    ]);
    return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
}
/**
 * Importa clienti da array (bulk)
 */
function importCustomers(newCustomers) {
    try {
        const customers = loadCustomers();
        const maxId = customers.length > 0 ? Math.max(...customers.map(c => c.id)) : 0;
        let addedCount = 0;
        newCustomers.forEach((c, index) => {
            const customer = Object.assign(Object.assign({ id: maxId + addedCount + 1 }, c), { isActive: c.isActive !== false, createdAt: new Date(), updatedAt: new Date() });
            customers.push(customer);
            addedCount++;
        });
        saveCustomers(customers);
        return addedCount;
    }
    catch (error) {
        console.error('Error importing customers:', error);
        return 0;
    }
}
