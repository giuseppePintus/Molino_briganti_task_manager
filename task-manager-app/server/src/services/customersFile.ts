import fs from 'fs';
import path from 'path';

/**
 * Gestisce la persistenza dei clienti su file JSON statico nel NAS
 * File: /app/data/customers.json (bind mount da NAS)
 */

export class DuplicateNameError extends Error {
  constructor(name: string) {
    super(`Cliente con ragione sociale "${name}" già esistente`);
    this.name = 'DuplicateNameError';
  }
}

export interface Destination {
  id: number;
  label: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  cap?: string | null;
  phone?: string | null;
  notes?: string | null;
  openMorningStart?: string | null;
  openMorningEnd?: string | null;
  openAfternoonStart?: string | null;
  openAfternoonEnd?: string | null;
  deliveryMorningStart?: string | null;
  deliveryMorningEnd?: string | null;
  deliveryAfternoonStart?: string | null;
  deliveryAfternoonEnd?: string | null;
}

export interface Customer {
  id: number;
  code?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  cap?: string | null;
  phone?: string | null;
  email?: string | null;
  piva?: string | null;
  cf?: string | null;
  notes?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  deliveryStartTime?: string | null;
  deliveryEndTime?: string | null;
  destinations?: Destination[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const CUSTOMERS_FILE = '/app/data/customers.json';

/**
 * Assicura che la directory /app/data esista
 */
function ensureDataDir() {
  const dir = path.dirname(CUSTOMERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created data directory: ${dir}`);
  }
}

/**
 * Carica tutti i clienti dal file JSON
 */
export function loadCustomers(): Customer[] {
  try {
    ensureDataDir();
    
    if (!fs.existsSync(CUSTOMERS_FILE)) {
      console.log(`ℹ️ Customers file not found at ${CUSTOMERS_FILE}, returning empty array`);
      return [];
    }
    
    const data = fs.readFileSync(CUSTOMERS_FILE, 'utf-8');
    const customers = JSON.parse(data) as Customer[];
    console.log(`✅ Loaded ${customers.length} customers from ${CUSTOMERS_FILE}`);
    return customers;
  } catch (error) {
    console.error(`❌ Error loading customers from file:`, error);
    return [];
  }
}

/**
 * Salva tutti i clienti nel file JSON
 */
export function saveCustomers(customers: Customer[]): boolean {
  try {
    ensureDataDir();
    
    const data = JSON.stringify(customers, null, 2);
    fs.writeFileSync(CUSTOMERS_FILE, data, 'utf-8');
    console.log(`✅ Saved ${customers.length} customers to ${CUSTOMERS_FILE}`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving customers to file:`, error);
    return false;
  }
}

/**
 * Carica un singolo cliente per ID
 */
export function getCustomerById(id: number): Customer | null {
  const customers = loadCustomers();
  return customers.find(c => c.id === id) || null;
}

/**
 * Aggiungi un nuovo cliente
 */
export function addCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer | null {
  try {
    const customers = loadCustomers();
    
    // Controllo unicità ragione sociale (case-insensitive)
    const duplicate = customers.find(c => c.name.trim().toLowerCase() === customer.name.trim().toLowerCase());
    if (duplicate) {
      throw new DuplicateNameError(customer.name);
    }
    
    // Genera nuovo ID (max id + 1)
    const maxId = customers.length > 0 ? Math.max(...customers.map(c => c.id)) : 0;
    const newId = maxId + 1;
    
    const newCustomer: Customer = {
      id: newId,
      ...customer,
      destinations: customer.destinations || [],
      isActive: customer.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    customers.push(newCustomer);
    saveCustomers(customers);
    
    return newCustomer;
  } catch (error) {
    if (error instanceof DuplicateNameError) throw error;
    console.error('Error adding customer:', error);
    return null;
  }
}

/**
 * Aggiorna un cliente
 */
export function updateCustomer(id: number, updates: Partial<Customer>): Customer | null {
  try {
    const customers = loadCustomers();
    const index = customers.findIndex(c => c.id === id);
    
    if (index === -1) {
      return null;
    }
    
    // Controllo unicità ragione sociale se si sta cambiando il nome
    if (updates.name !== undefined) {
      const duplicate = customers.find(c => c.id !== id && c.name.trim().toLowerCase() === updates.name!.trim().toLowerCase());
      if (duplicate) {
        throw new DuplicateNameError(updates.name);
      }
    }
    
    customers[index] = {
      ...customers[index],
      ...updates,
      id, // Mantieni ID
      createdAt: customers[index].createdAt, // Mantieni createdAt
      updatedAt: new Date()
    };
    
    saveCustomers(customers);
    return customers[index];
  } catch (error) {
    if (error instanceof DuplicateNameError) throw error;
    console.error('Error updating customer:', error);
    return null;
  }
}

/**
 * Elimina un cliente
 */
export function deleteCustomer(id: number): boolean {
  try {
    const customers = loadCustomers();
    const filtered = customers.filter(c => c.id !== id);
    
    if (filtered.length === customers.length) {
      // Customer non trovato
      return false;
    }
    
    saveCustomers(filtered);
    return true;
  } catch (error) {
    console.error('Error deleting customer:', error);
    return false;
  }
}

/**
 * Ricerca clienti per name/code/city/email
 */
export function searchCustomers(query: string, activeOnly: boolean = false): Customer[] {
  const customers = loadCustomers();
  const search = query.toLowerCase();
  
  return customers.filter(c => {
    if (activeOnly && !c.isActive) return false;
    
    return (
      (c.name && c.name.toLowerCase().includes(search)) ||
      (c.code && c.code.toLowerCase().includes(search)) ||
      (c.city && c.city.toLowerCase().includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search))
    );
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Esporta clienti come CSV
 */
export function exportAsCSV(): string {
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
export function importCustomers(newCustomers: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>[]): number {
  try {
    const customers = loadCustomers();
    const maxId = customers.length > 0 ? Math.max(...customers.map(c => c.id)) : 0;
    
    let addedCount = 0;
    newCustomers.forEach((c, index) => {
      const customer: Customer = {
        id: maxId + addedCount + 1,
        ...c,
        isActive: c.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      customers.push(customer);
      addedCount++;
    });
    
    saveCustomers(customers);
    return addedCount;
  } catch (error) {
    console.error('Error importing customers:', error);
    return 0;
  }
}

// ============================================================
// DESTINAZIONI MULTIPLE
// ============================================================

/**
 * Restituisce le destinazioni di un cliente
 */
export function getDestinations(customerId: number): Destination[] {
  const customer = getCustomerById(customerId);
  if (!customer) return [];
  return customer.destinations || [];
}

/**
 * Aggiunge una destinazione a un cliente
 */
export function addDestination(customerId: number, dest: Omit<Destination, 'id'>): Destination | null {
  try {
    const customers = loadCustomers();
    const index = customers.findIndex(c => c.id === customerId);
    if (index === -1) return null;

    const destinations = customers[index].destinations || [];
    const maxId = destinations.length > 0 ? Math.max(...destinations.map(d => d.id)) : 0;
    const newDest: Destination = { id: maxId + 1, ...dest };

    customers[index].destinations = [...destinations, newDest];
    customers[index].updatedAt = new Date();
    saveCustomers(customers);
    return newDest;
  } catch (error) {
    console.error('Error adding destination:', error);
    return null;
  }
}

/**
 * Aggiorna una destinazione
 */
export function updateDestination(customerId: number, destId: number, updates: Partial<Destination>): Destination | null {
  try {
    const customers = loadCustomers();
    const custIndex = customers.findIndex(c => c.id === customerId);
    if (custIndex === -1) return null;

    const destinations = customers[custIndex].destinations || [];
    const destIndex = destinations.findIndex(d => d.id === destId);
    if (destIndex === -1) return null;

    destinations[destIndex] = { ...destinations[destIndex], ...updates, id: destId };
    customers[custIndex].destinations = destinations;
    customers[custIndex].updatedAt = new Date();
    saveCustomers(customers);
    return destinations[destIndex];
  } catch (error) {
    console.error('Error updating destination:', error);
    return null;
  }
}

/**
 * Elimina una destinazione
 */
export function deleteDestination(customerId: number, destId: number): boolean {
  try {
    const customers = loadCustomers();
    const custIndex = customers.findIndex(c => c.id === customerId);
    if (custIndex === -1) return false;

    const before = (customers[custIndex].destinations || []).length;
    customers[custIndex].destinations = (customers[custIndex].destinations || []).filter(d => d.id !== destId);
    if ((customers[custIndex].destinations || []).length === before) return false;

    customers[custIndex].updatedAt = new Date();
    saveCustomers(customers);
    return true;
  } catch (error) {
    console.error('Error deleting destination:', error);
    return false;
  }
}
