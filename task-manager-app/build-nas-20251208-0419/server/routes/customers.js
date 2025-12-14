"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const CustomersFile = __importStar(require("../services/customersFile"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
/**
 * GET /api/customers
 * Lista tutti i clienti (caricati da file JSON statico)
 */
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { search, active } = req.query;
        // Carica clienti dal file statico
        let customers = CustomersFile.loadCustomers();
        // Filtra per stato attivo
        if (active !== undefined) {
            const isActive = active === 'true';
            customers = customers.filter(c => c.isActive === isActive);
        }
        // Ricerca
        if (search) {
            const searchLower = search.toLowerCase();
            customers = customers.filter(c => c.name.toLowerCase().includes(searchLower) ||
                (c.code && c.code.toLowerCase().includes(searchLower)) ||
                (c.city && c.city.toLowerCase().includes(searchLower)) ||
                (c.email && c.email.toLowerCase().includes(searchLower)));
        }
        // Ordina per nome
        customers.sort((a, b) => a.name.localeCompare(b.name));
        // Aggiungi campi italiani per compatibilità frontend
        const customersWithItalianFields = customers.map(c => (Object.assign(Object.assign({}, c), { nome: c.name, indirizzo: c.address, città: c.city, telefono: c.phone, orario_apertura: c.openingTime, orario_chiusura: c.closingTime, orario_consegna_inizio: c.deliveryStartTime, orario_consegna_fine: c.deliveryEndTime })));
        res.json(customersWithItalianFields);
    }
    catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * GET /api/customers/:id
 * Ottieni singolo cliente (dal file statico)
 */
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const customerId = parseInt(id);
        // Carica dal file statico
        const customer = CustomersFile.getCustomerById(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        // Aggiungi campi italiani per compatibilità
        const response = Object.assign(Object.assign({}, customer), { nome: customer.name, indirizzo: customer.address, città: customer.city, telefono: customer.phone, orario_apertura: customer.openingTime, orario_chiusura: customer.closingTime, orario_consegna_inizio: customer.deliveryStartTime, orario_consegna_fine: customer.deliveryEndTime });
        res.json(response);
    }
    catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * POST /api/customers
 * Crea nuovo cliente (salvato nel file statico)
 * Accetta sia campi inglesi che italiani per compatibilità con frontend
 */
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const body = req.body;
        // Mappa campi italiani -> inglesi per compatibilità
        const name = body.name || body.nome;
        const address = body.address || body.indirizzo;
        const city = body.city || body.città;
        const phone = body.phone || body.telefono;
        const email = body.email;
        const code = body.code || body.codice;
        const province = body.province || body.provincia;
        const cap = body.cap;
        const piva = body.piva;
        const cf = body.cf;
        const notes = body.notes || body.note;
        // Campi orari specifici del frontend italiano
        const openingTime = body.orario_apertura;
        const closingTime = body.orario_chiusura;
        const deliveryStartTime = body.orario_consegna_inizio;
        const deliveryEndTime = body.orario_consegna_fine;
        if (!name) {
            return res.status(400).json({ error: 'Nome cliente obbligatorio' });
        }
        // Salva nel file statico
        const customer = CustomersFile.addCustomer({
            code: code || null,
            name,
            address: address || null,
            city: city || null,
            province: province || null,
            cap: cap || null,
            phone: phone || null,
            email: email || null,
            piva: piva || null,
            cf: cf || null,
            notes: notes || null,
            openingTime: openingTime || null,
            closingTime: closingTime || null,
            deliveryStartTime: deliveryStartTime || null,
            deliveryEndTime: deliveryEndTime || null,
            isActive: true
        });
        if (!customer) {
            return res.status(500).json({ error: 'Errore nel salvataggio del cliente' });
        }
        // Restituisci anche con campi italiani per compatibilità frontend
        const response = Object.assign(Object.assign({}, customer), { nome: customer.name, indirizzo: customer.address, città: customer.city, telefono: customer.phone, orario_apertura: customer.openingTime, orario_chiusura: customer.closingTime, orario_consegna_inizio: customer.deliveryStartTime, orario_consegna_fine: customer.deliveryEndTime });
        res.status(201).json(response);
    }
    catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * PUT /api/customers/:id
 * Aggiorna cliente (nel file statico)
 * Accetta sia campi inglesi che italiani per compatibilità
 */
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const body = req.body;
        const updateData = {};
        // Mappa campi italiani -> inglesi
        const name = body.name || body.nome;
        const address = body.address || body.indirizzo;
        const city = body.city || body.città;
        const phone = body.phone || body.telefono;
        const code = body.code || body.codice;
        const province = body.province || body.provincia;
        const notes = body.notes || body.note;
        const openingTime = body.openingTime || body.orario_apertura;
        const closingTime = body.closingTime || body.orario_chiusura;
        const deliveryStartTime = body.deliveryStartTime || body.orario_consegna_inizio;
        const deliveryEndTime = body.deliveryEndTime || body.orario_consegna_fine;
        if (code !== undefined)
            updateData.code = code;
        if (name !== undefined)
            updateData.name = name;
        if (address !== undefined)
            updateData.address = address;
        if (city !== undefined)
            updateData.city = city;
        if (province !== undefined)
            updateData.province = province;
        if (body.cap !== undefined)
            updateData.cap = body.cap;
        if (phone !== undefined)
            updateData.phone = phone;
        if (body.email !== undefined)
            updateData.email = body.email;
        if (body.piva !== undefined)
            updateData.piva = body.piva;
        if (body.cf !== undefined)
            updateData.cf = body.cf;
        if (notes !== undefined)
            updateData.notes = notes;
        if (body.isActive !== undefined)
            updateData.isActive = body.isActive;
        if (openingTime !== undefined)
            updateData.openingTime = openingTime;
        if (closingTime !== undefined)
            updateData.closingTime = closingTime;
        if (deliveryStartTime !== undefined)
            updateData.deliveryStartTime = deliveryStartTime;
        if (deliveryEndTime !== undefined)
            updateData.deliveryEndTime = deliveryEndTime;
        // Aggiorna nel file statico
        const customer = CustomersFile.updateCustomer(parseInt(id), updateData);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        // Restituisci con campi italiani per compatibilità
        const response = Object.assign(Object.assign({}, customer), { nome: customer.name, indirizzo: customer.address, città: customer.city, telefono: customer.phone, orario_apertura: customer.openingTime, orario_chiusura: customer.closingTime, orario_consegna_inizio: customer.deliveryStartTime, orario_consegna_fine: customer.deliveryEndTime });
        res.json(response);
    }
    catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * DELETE /api/customers/:id
 * Elimina cliente dal file statico (soft o hard delete)
 */
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { hard } = req.query;
        if (hard === 'true') {
            // Hard delete - rimuovi completamente
            const deleted = CustomersFile.deleteCustomer(parseInt(id));
            if (!deleted) {
                return res.status(404).json({ error: 'Customer not found' });
            }
        }
        else {
            // Soft delete - imposta isActive = false
            const customer = CustomersFile.updateCustomer(parseInt(id), { isActive: false });
            if (!customer) {
                return res.status(404).json({ error: 'Customer not found' });
            }
        }
        res.json({ success: true, message: 'Customer deleted' });
    }
    catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * POST /api/customers/bulk
 * Importa clienti in blocco da file statico
 */
router.post('/bulk', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { customers } = req.body;
        if (!Array.isArray(customers)) {
            return res.status(400).json({ error: 'customers must be an array' });
        }
        let created = 0;
        let updated = 0;
        let errors = 0;
        const existingCustomers = CustomersFile.loadCustomers();
        for (const c of customers) {
            try {
                // Cerca cliente esistente per codice o nome
                const existing = c.code
                    ? existingCustomers.find(ec => ec.code === c.code)
                    : existingCustomers.find(ec => ec.name === c.name);
                if (existing) {
                    // Aggiorna
                    CustomersFile.updateCustomer(existing.id, {
                        name: c.name || existing.name,
                        address: c.address || c.indirizzo || existing.address,
                        city: c.city || c.citta || existing.city,
                        province: c.province || c.provincia || existing.province,
                        cap: c.cap || existing.cap,
                        phone: c.phone || c.telefono || existing.phone,
                        email: c.email || existing.email,
                        piva: c.piva || c.partitaIva || existing.piva,
                        cf: c.cf || c.codiceFiscale || existing.cf,
                        notes: c.notes || c.note || existing.notes
                    });
                    updated++;
                }
                else {
                    // Crea nuovo
                    CustomersFile.addCustomer({
                        code: c.code || null,
                        name: c.name || c.ragioneSociale || 'Cliente senza nome',
                        address: c.address || c.indirizzo || null,
                        city: c.city || c.citta || null,
                        province: c.province || c.provincia || null,
                        cap: c.cap || null,
                        phone: c.phone || c.telefono || null,
                        email: c.email || null,
                        piva: c.piva || c.partitaIva || null,
                        cf: c.cf || c.codiceFiscale || null,
                        notes: c.notes || c.note || null,
                        isActive: true
                    });
                    created++;
                }
            }
            catch (e) {
                errors++;
            }
        }
        res.status(201).json({
            success: true,
            created,
            updated,
            errors,
            message: `Imported: ${created} created, ${updated} updated, ${errors} errors`
        });
    }
    catch (error) {
        console.error('Error bulk importing customers:', error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * POST /api/customers/import-csv
 * Importa clienti da CSV (dal file esistente)
 */
router.post('/import-csv', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fs = require('fs');
        const path = require('path');
        const csvPath = path.join(__dirname, '../../..', 'public/data/clienti.csv');
        if (!fs.existsSync(csvPath)) {
            return res.status(404).json({ error: 'CSV file not found' });
        }
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter((l) => l.trim());
        if (lines.length < 2) {
            return res.status(400).json({ error: 'CSV file is empty or invalid' });
        }
        const headers = lines[0].split(';').map((h) => h.trim().toLowerCase());
        const customers = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(';');
            const customer = {};
            headers.forEach((header, idx) => {
                var _a;
                customer[header] = ((_a = values[idx]) === null || _a === void 0 ? void 0 : _a.trim()) || null;
            });
            customers.push({
                code: customer.codice || customer.code,
                name: customer.ragionesociale || customer.nome || customer.name,
                address: customer.indirizzo || customer.address,
                city: customer.citta || customer.city,
                province: customer.provincia || customer.province,
                cap: customer.cap,
                phone: customer.telefono || customer.phone,
                email: customer.email,
                piva: customer.partitaiva || customer.piva,
                cf: customer.codicefiscale || customer.cf,
                notes: customer.note || customer.notes
            });
        }
        // Usa bulk import
        let created = 0;
        for (const c of customers) {
            if (!c.name)
                continue;
            try {
                yield prisma.customer.upsert({
                    where: { code: c.code || `AUTO_${Date.now()}_${created}` },
                    update: {
                        name: c.name,
                        address: c.address,
                        city: c.city,
                        province: c.province,
                        cap: c.cap,
                        phone: c.phone,
                        email: c.email,
                        piva: c.piva,
                        cf: c.cf,
                        notes: c.notes
                    },
                    create: {
                        code: c.code || null,
                        name: c.name,
                        address: c.address,
                        city: c.city,
                        province: c.province,
                        cap: c.cap,
                        phone: c.phone,
                        email: c.email,
                        piva: c.piva,
                        cf: c.cf,
                        notes: c.notes,
                        isActive: true
                    }
                });
                created++;
            }
            catch (e) {
                // Skip duplicates
            }
        }
        res.json({
            success: true,
            count: created,
            message: `${created} customers imported from CSV`
        });
    }
    catch (error) {
        console.error('Error importing CSV:', error);
        res.status(500).json({ error: error.message });
    }
}));
exports.default = router;
