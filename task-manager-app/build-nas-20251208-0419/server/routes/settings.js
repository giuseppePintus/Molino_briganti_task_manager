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
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Default company settings
const defaultSettings = {
    businessName: 'Molino Briganti',
    logoUrl: 'images/logo INSEGNA.png',
    openingDays: [1, 2, 3, 4, 5, 6],
    openMorningStart: '08:00',
    openMorningEnd: '13:00',
    openAfternoonStart: '15:00',
    openAfternoonEnd: '18:00',
    openSatMorningStart: '08:00',
    openSatMorningEnd: '12:00',
    openSatAfternoonStart: '',
    openSatAfternoonEnd: '',
    deliveryDays: [1, 2, 3, 4, 5, 6],
    deliveryMorningStart: '08:00',
    deliveryMorningEnd: '12:00',
    deliveryAfternoonStart: '15:00',
    deliveryAfternoonEnd: '18:00',
    deliverySatMorningStart: '08:00',
    deliverySatMorningEnd: '12:00',
    deliverySatAfternoonStart: '',
    deliverySatAfternoonEnd: ''
};
/**
 * GET /api/settings/company
 * Ottieni tutte le impostazioni aziendali dal database
 */
router.get('/company', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const settings = yield prisma.companySettings.findMany();
        // Converti array di key-value in oggetto
        const result = Object.assign({}, defaultSettings);
        for (const setting of settings) {
            try {
                result[setting.key] = JSON.parse(setting.value);
            }
            catch (_a) {
                result[setting.key] = setting.value;
            }
        }
        // Carica veicoli
        const vehicles = yield prisma.vehicle.findMany({
            where: { isActive: true },
            orderBy: { id: 'asc' }
        });
        result.vehicles = vehicles;
        // Carica festivi
        const holidays = yield prisma.holiday.findMany({
            orderBy: { date: 'asc' }
        });
        result.holidays = holidays.map(h => h.date.toISOString().split('T')[0]);
        res.json(result);
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        console.error('Error fetching company settings:', errorMsg);
        res.status(500).json({ message: errorMsg });
    }
}));
/**
 * PUT /api/settings/company
 * Salva tutte le impostazioni aziendali nel database
 */
router.put('/company', auth_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'master') {
            return res.status(403).json({ message: 'Only master can update settings' });
        }
        const { businessName, logoUrl, openingDays, openMorningStart, openMorningEnd, openAfternoonStart, openAfternoonEnd, openSatMorningStart, openSatMorningEnd, openSatAfternoonStart, openSatAfternoonEnd, deliveryDays, deliveryMorningStart, deliveryMorningEnd, deliveryAfternoonStart, deliveryAfternoonEnd, deliverySatMorningStart, deliverySatMorningEnd, deliverySatAfternoonStart, deliverySatAfternoonEnd, holidays, vehicles } = req.body;
        // Salva impostazioni come key-value
        const settingsToSave = [
            { key: 'businessName', value: JSON.stringify(businessName) },
            { key: 'logoUrl', value: JSON.stringify(logoUrl) },
            { key: 'openingDays', value: JSON.stringify(openingDays) },
            { key: 'openMorningStart', value: JSON.stringify(openMorningStart) },
            { key: 'openMorningEnd', value: JSON.stringify(openMorningEnd) },
            { key: 'openAfternoonStart', value: JSON.stringify(openAfternoonStart) },
            { key: 'openAfternoonEnd', value: JSON.stringify(openAfternoonEnd) },
            { key: 'openSatMorningStart', value: JSON.stringify(openSatMorningStart) },
            { key: 'openSatMorningEnd', value: JSON.stringify(openSatMorningEnd) },
            { key: 'openSatAfternoonStart', value: JSON.stringify(openSatAfternoonStart) },
            { key: 'openSatAfternoonEnd', value: JSON.stringify(openSatAfternoonEnd) },
            { key: 'deliveryDays', value: JSON.stringify(deliveryDays) },
            { key: 'deliveryMorningStart', value: JSON.stringify(deliveryMorningStart) },
            { key: 'deliveryMorningEnd', value: JSON.stringify(deliveryMorningEnd) },
            { key: 'deliveryAfternoonStart', value: JSON.stringify(deliveryAfternoonStart) },
            { key: 'deliveryAfternoonEnd', value: JSON.stringify(deliveryAfternoonEnd) },
            { key: 'deliverySatMorningStart', value: JSON.stringify(deliverySatMorningStart) },
            { key: 'deliverySatMorningEnd', value: JSON.stringify(deliverySatMorningEnd) },
            { key: 'deliverySatAfternoonStart', value: JSON.stringify(deliverySatAfternoonStart) },
            { key: 'deliverySatAfternoonEnd', value: JSON.stringify(deliverySatAfternoonEnd) }
        ];
        // Upsert ogni impostazione
        for (const setting of settingsToSave) {
            if (setting.value !== undefined && setting.value !== 'undefined') {
                yield prisma.companySettings.upsert({
                    where: { key: setting.key },
                    update: { value: setting.value },
                    create: { key: setting.key, value: setting.value }
                });
            }
        }
        // Gestisci veicoli
        if (Array.isArray(vehicles)) {
            // Disattiva tutti i veicoli esistenti
            yield prisma.vehicle.updateMany({
                data: { isActive: false }
            });
            // Crea/aggiorna veicoli usando upsert per evitare errori
            for (const v of vehicles) {
                if (v.id && typeof v.id === 'number') {
                    // Prova prima a trovare il veicolo, se non esiste crealo
                    const existingVehicle = yield prisma.vehicle.findUnique({
                        where: { id: v.id }
                    });
                    if (existingVehicle) {
                        yield prisma.vehicle.update({
                            where: { id: v.id },
                            data: { name: v.name, isActive: true }
                        });
                    }
                    else {
                        // L'ID non esiste nel DB, crea un nuovo veicolo
                        yield prisma.vehicle.create({
                            data: { name: v.name, isActive: true }
                        });
                    }
                }
                else {
                    yield prisma.vehicle.create({
                        data: { name: v.name, isActive: true }
                    });
                }
            }
        }
        // Gestisci festivi
        if (Array.isArray(holidays)) {
            // Elimina tutti i festivi esistenti
            yield prisma.holiday.deleteMany({});
            // Crea nuovi festivi
            for (const dateStr of holidays) {
                yield prisma.holiday.create({
                    data: { date: new Date(dateStr + 'T00:00:00Z') }
                });
            }
        }
        res.json({ message: 'Settings saved successfully' });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        console.error('Error saving company settings:', errorMsg);
        res.status(500).json({ message: errorMsg });
    }
}));
// GET settings legacy - disponibile a tutti gli utenti autenticati (compatibilità)
router.get('/', auth_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Prova a caricare dal database
        const settings = yield prisma.companySettings.findMany();
        if (settings.length > 0) {
            const result = Object.assign({}, defaultSettings);
            for (const setting of settings) {
                try {
                    result[setting.key] = JSON.parse(setting.value);
                }
                catch (_a) {
                    result[setting.key] = setting.value;
                }
            }
            // Carica veicoli
            const vehicles = yield prisma.vehicle.findMany({
                where: { isActive: true },
                orderBy: { id: 'asc' }
            });
            result.vehicles = vehicles;
            // Carica festivi
            const holidays = yield prisma.holiday.findMany({
                orderBy: { date: 'asc' }
            });
            result.holidays = holidays.map(h => h.date.toISOString().split('T')[0]);
            return res.json(result);
        }
        // Fallback ai default
        res.json(defaultSettings);
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ message: errorMsg });
    }
}));
// UPDATE settings legacy - solo master (compatibilità)
router.put('/', auth_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'master') {
            return res.status(403).json({ message: 'Only master can update settings' });
        }
        const { businessName, logoUrl, openingDays, openMorningStart, openMorningEnd, openAfternoonStart, openAfternoonEnd, openSatMorningStart, openSatMorningEnd, openSatAfternoonStart, openSatAfternoonEnd, deliveryDays, deliveryMorningStart, deliveryMorningEnd, deliveryAfternoonStart, deliveryAfternoonEnd, deliverySatMorningStart, deliverySatMorningEnd, deliverySatAfternoonStart, deliverySatAfternoonEnd, holidays, vehicles } = req.body;
        // Salva impostazioni come key-value
        const settingsToSave = [];
        if (businessName !== undefined)
            settingsToSave.push({ key: 'businessName', value: JSON.stringify(businessName) });
        if (logoUrl !== undefined)
            settingsToSave.push({ key: 'logoUrl', value: JSON.stringify(logoUrl) });
        if (openingDays !== undefined)
            settingsToSave.push({ key: 'openingDays', value: JSON.stringify(openingDays) });
        if (openMorningStart !== undefined)
            settingsToSave.push({ key: 'openMorningStart', value: JSON.stringify(openMorningStart) });
        if (openMorningEnd !== undefined)
            settingsToSave.push({ key: 'openMorningEnd', value: JSON.stringify(openMorningEnd) });
        if (openAfternoonStart !== undefined)
            settingsToSave.push({ key: 'openAfternoonStart', value: JSON.stringify(openAfternoonStart) });
        if (openAfternoonEnd !== undefined)
            settingsToSave.push({ key: 'openAfternoonEnd', value: JSON.stringify(openAfternoonEnd) });
        if (openSatMorningStart !== undefined)
            settingsToSave.push({ key: 'openSatMorningStart', value: JSON.stringify(openSatMorningStart) });
        if (openSatMorningEnd !== undefined)
            settingsToSave.push({ key: 'openSatMorningEnd', value: JSON.stringify(openSatMorningEnd) });
        if (openSatAfternoonStart !== undefined)
            settingsToSave.push({ key: 'openSatAfternoonStart', value: JSON.stringify(openSatAfternoonStart) });
        if (openSatAfternoonEnd !== undefined)
            settingsToSave.push({ key: 'openSatAfternoonEnd', value: JSON.stringify(openSatAfternoonEnd) });
        if (deliveryDays !== undefined)
            settingsToSave.push({ key: 'deliveryDays', value: JSON.stringify(deliveryDays) });
        if (deliveryMorningStart !== undefined)
            settingsToSave.push({ key: 'deliveryMorningStart', value: JSON.stringify(deliveryMorningStart) });
        if (deliveryMorningEnd !== undefined)
            settingsToSave.push({ key: 'deliveryMorningEnd', value: JSON.stringify(deliveryMorningEnd) });
        if (deliveryAfternoonStart !== undefined)
            settingsToSave.push({ key: 'deliveryAfternoonStart', value: JSON.stringify(deliveryAfternoonStart) });
        if (deliveryAfternoonEnd !== undefined)
            settingsToSave.push({ key: 'deliveryAfternoonEnd', value: JSON.stringify(deliveryAfternoonEnd) });
        if (deliverySatMorningStart !== undefined)
            settingsToSave.push({ key: 'deliverySatMorningStart', value: JSON.stringify(deliverySatMorningStart) });
        if (deliverySatMorningEnd !== undefined)
            settingsToSave.push({ key: 'deliverySatMorningEnd', value: JSON.stringify(deliverySatMorningEnd) });
        if (deliverySatAfternoonStart !== undefined)
            settingsToSave.push({ key: 'deliverySatAfternoonStart', value: JSON.stringify(deliverySatAfternoonStart) });
        if (deliverySatAfternoonEnd !== undefined)
            settingsToSave.push({ key: 'deliverySatAfternoonEnd', value: JSON.stringify(deliverySatAfternoonEnd) });
        // Upsert ogni impostazione
        for (const setting of settingsToSave) {
            yield prisma.companySettings.upsert({
                where: { key: setting.key },
                update: { value: setting.value },
                create: { key: setting.key, value: setting.value }
            });
        }
        // Gestisci veicoli
        if (Array.isArray(vehicles)) {
            yield prisma.vehicle.updateMany({ data: { isActive: false } });
            for (const v of vehicles) {
                if (v.id && typeof v.id === 'number') {
                    // Controlla se il veicolo esiste prima di aggiornarlo
                    const existingVehicle = yield prisma.vehicle.findUnique({
                        where: { id: v.id }
                    });
                    if (existingVehicle) {
                        yield prisma.vehicle.update({
                            where: { id: v.id },
                            data: { name: v.name, isActive: true }
                        });
                    }
                    else {
                        // L'ID non esiste nel DB, crea un nuovo veicolo
                        yield prisma.vehicle.create({
                            data: { name: v.name, isActive: true }
                        });
                    }
                }
                else {
                    yield prisma.vehicle.create({
                        data: { name: v.name, isActive: true }
                    });
                }
            }
        }
        // Gestisci festivi
        if (Array.isArray(holidays)) {
            yield prisma.holiday.deleteMany({});
            for (const dateStr of holidays) {
                yield prisma.holiday.create({
                    data: { date: new Date(dateStr + 'T00:00:00Z') }
                });
            }
        }
        res.json({ message: 'Settings saved successfully' });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        console.error('Error saving settings:', errorMsg);
        res.status(500).json({ message: errorMsg });
    }
}));
/**
 * GET /api/settings/vehicles
 * Lista veicoli
 */
router.get('/vehicles', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vehicles = yield prisma.vehicle.findMany({
            where: { isActive: true },
            orderBy: { id: 'asc' }
        });
        res.json(vehicles);
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ message: errorMsg });
    }
}));
/**
 * POST /api/settings/vehicles
 * Crea veicolo
 */
router.post('/vehicles', auth_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'master') {
            return res.status(403).json({ message: 'Only master can add vehicles' });
        }
        const { name, plate } = req.body;
        const vehicle = yield prisma.vehicle.create({
            data: { name, plate: plate || null, isActive: true }
        });
        res.status(201).json(vehicle);
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ message: errorMsg });
    }
}));
/**
 * DELETE /api/settings/vehicles/:id
 * Elimina veicolo
 */
router.delete('/vehicles/:id', auth_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'master') {
            return res.status(403).json({ message: 'Only master can delete vehicles' });
        }
        const { id } = req.params;
        const vehicleId = parseInt(id);
        // Controlla se il veicolo esiste prima di aggiornarlo
        const existingVehicle = yield prisma.vehicle.findUnique({
            where: { id: vehicleId }
        });
        if (!existingVehicle) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }
        yield prisma.vehicle.update({
            where: { id: vehicleId },
            data: { isActive: false }
        });
        res.json({ success: true });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ message: errorMsg });
    }
}));
/**
 * GET /api/settings/holidays
 * Lista festivi
 */
router.get('/holidays', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const holidays = yield prisma.holiday.findMany({
            orderBy: { date: 'asc' }
        });
        res.json(holidays.map(h => ({
            id: h.id,
            date: h.date.toISOString().split('T')[0],
            description: h.description
        })));
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ message: errorMsg });
    }
}));
/**
 * POST /api/settings/holidays
 * Aggiungi festivo
 */
router.post('/holidays', auth_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'master') {
            return res.status(403).json({ message: 'Only master can add holidays' });
        }
        const { date, description } = req.body;
        const holiday = yield prisma.holiday.create({
            data: {
                date: new Date(date + 'T00:00:00Z'),
                description: description || null
            }
        });
        res.status(201).json({
            id: holiday.id,
            date: holiday.date.toISOString().split('T')[0],
            description: holiday.description
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ message: errorMsg });
    }
}));
/**
 * DELETE /api/settings/holidays/:id
 * Elimina festivo
 */
router.delete('/holidays/:id', auth_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'master') {
            return res.status(403).json({ message: 'Only master can delete holidays' });
        }
        const { id } = req.params;
        yield prisma.holiday.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ message: errorMsg });
    }
}));
exports.default = router;
