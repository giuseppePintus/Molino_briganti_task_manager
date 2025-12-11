"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var auth_1 = require("../middleware/auth");
var client_1 = require("@prisma/client");
var router = (0, express_1.Router)();
var prisma = new client_1.PrismaClient();
// Default company settings
var defaultSettings = {
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
router.get('/company', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var settings, result, _i, settings_1, setting, vehicles, holidays, err_1, errorMsg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, prisma.companySettings.findMany()];
            case 1:
                settings = _a.sent();
                result = __assign({}, defaultSettings);
                for (_i = 0, settings_1 = settings; _i < settings_1.length; _i++) {
                    setting = settings_1[_i];
                    try {
                        result[setting.key] = JSON.parse(setting.value);
                    }
                    catch (_b) {
                        result[setting.key] = setting.value;
                    }
                }
                return [4 /*yield*/, prisma.vehicle.findMany({
                        where: { isActive: true },
                        orderBy: { id: 'asc' }
                    })];
            case 2:
                vehicles = _a.sent();
                result.vehicles = vehicles;
                return [4 /*yield*/, prisma.holiday.findMany({
                        orderBy: { date: 'asc' }
                    })];
            case 3:
                holidays = _a.sent();
                result.holidays = holidays.map(function (h) { return h.date.toISOString().split('T')[0]; });
                res.json(result);
                return [3 /*break*/, 5];
            case 4:
                err_1 = _a.sent();
                errorMsg = err_1 instanceof Error ? err_1.message : 'Internal server error';
                console.error('Error fetching company settings:', errorMsg);
                res.status(500).json({ message: errorMsg });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
/**
 * PUT /api/settings/company
 * Salva tutte le impostazioni aziendali nel database
 */
router.put('/company', auth_1.authMiddleware, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, businessName, logoUrl, openingDays, openMorningStart, openMorningEnd, openAfternoonStart, openAfternoonEnd, openSatMorningStart, openSatMorningEnd, openSatAfternoonStart, openSatAfternoonEnd, deliveryDays, deliveryMorningStart, deliveryMorningEnd, deliveryAfternoonStart, deliveryAfternoonEnd, deliverySatMorningStart, deliverySatMorningEnd, deliverySatAfternoonStart, deliverySatAfternoonEnd, holidays, vehicles, settingsToSave, _i, settingsToSave_1, setting, _b, vehicles_1, v, existingVehicle, _c, holidays_1, dateStr, err_2, errorMsg;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 21, , 22]);
                if (!req.user || req.user.role !== 'master') {
                    return [2 /*return*/, res.status(403).json({ message: 'Only master can update settings' })];
                }
                _a = req.body, businessName = _a.businessName, logoUrl = _a.logoUrl, openingDays = _a.openingDays, openMorningStart = _a.openMorningStart, openMorningEnd = _a.openMorningEnd, openAfternoonStart = _a.openAfternoonStart, openAfternoonEnd = _a.openAfternoonEnd, openSatMorningStart = _a.openSatMorningStart, openSatMorningEnd = _a.openSatMorningEnd, openSatAfternoonStart = _a.openSatAfternoonStart, openSatAfternoonEnd = _a.openSatAfternoonEnd, deliveryDays = _a.deliveryDays, deliveryMorningStart = _a.deliveryMorningStart, deliveryMorningEnd = _a.deliveryMorningEnd, deliveryAfternoonStart = _a.deliveryAfternoonStart, deliveryAfternoonEnd = _a.deliveryAfternoonEnd, deliverySatMorningStart = _a.deliverySatMorningStart, deliverySatMorningEnd = _a.deliverySatMorningEnd, deliverySatAfternoonStart = _a.deliverySatAfternoonStart, deliverySatAfternoonEnd = _a.deliverySatAfternoonEnd, holidays = _a.holidays, vehicles = _a.vehicles;
                settingsToSave = [
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
                _i = 0, settingsToSave_1 = settingsToSave;
                _d.label = 1;
            case 1:
                if (!(_i < settingsToSave_1.length)) return [3 /*break*/, 4];
                setting = settingsToSave_1[_i];
                if (!(setting.value !== undefined && setting.value !== 'undefined')) return [3 /*break*/, 3];
                return [4 /*yield*/, prisma.companySettings.upsert({
                        where: { key: setting.key },
                        update: { value: setting.value },
                        create: { key: setting.key, value: setting.value }
                    })];
            case 2:
                _d.sent();
                _d.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4:
                if (!Array.isArray(vehicles)) return [3 /*break*/, 15];
                // Disattiva tutti i veicoli esistenti
                return [4 /*yield*/, prisma.vehicle.updateMany({
                        data: { isActive: false }
                    })];
            case 5:
                // Disattiva tutti i veicoli esistenti
                _d.sent();
                _b = 0, vehicles_1 = vehicles;
                _d.label = 6;
            case 6:
                if (!(_b < vehicles_1.length)) return [3 /*break*/, 15];
                v = vehicles_1[_b];
                if (!(v.id && typeof v.id === 'number')) return [3 /*break*/, 12];
                return [4 /*yield*/, prisma.vehicle.findUnique({
                        where: { id: v.id }
                    })];
            case 7:
                existingVehicle = _d.sent();
                if (!existingVehicle) return [3 /*break*/, 9];
                return [4 /*yield*/, prisma.vehicle.update({
                        where: { id: v.id },
                        data: { name: v.name, isActive: true }
                    })];
            case 8:
                _d.sent();
                return [3 /*break*/, 11];
            case 9: 
            // L'ID non esiste nel DB, crea un nuovo veicolo
            return [4 /*yield*/, prisma.vehicle.create({
                    data: { name: v.name, isActive: true }
                })];
            case 10:
                // L'ID non esiste nel DB, crea un nuovo veicolo
                _d.sent();
                _d.label = 11;
            case 11: return [3 /*break*/, 14];
            case 12: return [4 /*yield*/, prisma.vehicle.create({
                    data: { name: v.name, isActive: true }
                })];
            case 13:
                _d.sent();
                _d.label = 14;
            case 14:
                _b++;
                return [3 /*break*/, 6];
            case 15:
                if (!Array.isArray(holidays)) return [3 /*break*/, 20];
                // Elimina tutti i festivi esistenti
                return [4 /*yield*/, prisma.holiday.deleteMany({})];
            case 16:
                // Elimina tutti i festivi esistenti
                _d.sent();
                _c = 0, holidays_1 = holidays;
                _d.label = 17;
            case 17:
                if (!(_c < holidays_1.length)) return [3 /*break*/, 20];
                dateStr = holidays_1[_c];
                return [4 /*yield*/, prisma.holiday.create({
                        data: { date: new Date(dateStr + 'T00:00:00Z') }
                    })];
            case 18:
                _d.sent();
                _d.label = 19;
            case 19:
                _c++;
                return [3 /*break*/, 17];
            case 20:
                res.json({ message: 'Settings saved successfully' });
                return [3 /*break*/, 22];
            case 21:
                err_2 = _d.sent();
                errorMsg = err_2 instanceof Error ? err_2.message : 'Internal server error';
                console.error('Error saving company settings:', errorMsg);
                res.status(500).json({ message: errorMsg });
                return [3 /*break*/, 22];
            case 22: return [2 /*return*/];
        }
    });
}); });
// GET settings legacy - disponibile a tutti gli utenti autenticati (compatibilità)
router.get('/', auth_1.authMiddleware, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var settings, result, _i, settings_2, setting, vehicles, holidays, err_3, errorMsg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                return [4 /*yield*/, prisma.companySettings.findMany()];
            case 1:
                settings = _a.sent();
                if (!(settings.length > 0)) return [3 /*break*/, 4];
                result = __assign({}, defaultSettings);
                for (_i = 0, settings_2 = settings; _i < settings_2.length; _i++) {
                    setting = settings_2[_i];
                    try {
                        result[setting.key] = JSON.parse(setting.value);
                    }
                    catch (_b) {
                        result[setting.key] = setting.value;
                    }
                }
                return [4 /*yield*/, prisma.vehicle.findMany({
                        where: { isActive: true },
                        orderBy: { id: 'asc' }
                    })];
            case 2:
                vehicles = _a.sent();
                result.vehicles = vehicles;
                return [4 /*yield*/, prisma.holiday.findMany({
                        orderBy: { date: 'asc' }
                    })];
            case 3:
                holidays = _a.sent();
                result.holidays = holidays.map(function (h) { return h.date.toISOString().split('T')[0]; });
                return [2 /*return*/, res.json(result)];
            case 4:
                // Fallback ai default
                res.json(defaultSettings);
                return [3 /*break*/, 6];
            case 5:
                err_3 = _a.sent();
                errorMsg = err_3 instanceof Error ? err_3.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
// UPDATE settings legacy - solo master (compatibilità)
router.put('/', auth_1.authMiddleware, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, businessName, logoUrl, openingDays, openMorningStart, openMorningEnd, openAfternoonStart, openAfternoonEnd, openSatMorningStart, openSatMorningEnd, openSatAfternoonStart, openSatAfternoonEnd, deliveryDays, deliveryMorningStart, deliveryMorningEnd, deliveryAfternoonStart, deliveryAfternoonEnd, deliverySatMorningStart, deliverySatMorningEnd, deliverySatAfternoonStart, deliverySatAfternoonEnd, holidays, vehicles, settingsToSave, _i, settingsToSave_2, setting, _b, vehicles_2, v, existingVehicle, _c, holidays_2, dateStr, err_4, errorMsg;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 21, , 22]);
                if (!req.user || req.user.role !== 'master') {
                    return [2 /*return*/, res.status(403).json({ message: 'Only master can update settings' })];
                }
                _a = req.body, businessName = _a.businessName, logoUrl = _a.logoUrl, openingDays = _a.openingDays, openMorningStart = _a.openMorningStart, openMorningEnd = _a.openMorningEnd, openAfternoonStart = _a.openAfternoonStart, openAfternoonEnd = _a.openAfternoonEnd, openSatMorningStart = _a.openSatMorningStart, openSatMorningEnd = _a.openSatMorningEnd, openSatAfternoonStart = _a.openSatAfternoonStart, openSatAfternoonEnd = _a.openSatAfternoonEnd, deliveryDays = _a.deliveryDays, deliveryMorningStart = _a.deliveryMorningStart, deliveryMorningEnd = _a.deliveryMorningEnd, deliveryAfternoonStart = _a.deliveryAfternoonStart, deliveryAfternoonEnd = _a.deliveryAfternoonEnd, deliverySatMorningStart = _a.deliverySatMorningStart, deliverySatMorningEnd = _a.deliverySatMorningEnd, deliverySatAfternoonStart = _a.deliverySatAfternoonStart, deliverySatAfternoonEnd = _a.deliverySatAfternoonEnd, holidays = _a.holidays, vehicles = _a.vehicles;
                settingsToSave = [];
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
                _i = 0, settingsToSave_2 = settingsToSave;
                _d.label = 1;
            case 1:
                if (!(_i < settingsToSave_2.length)) return [3 /*break*/, 4];
                setting = settingsToSave_2[_i];
                return [4 /*yield*/, prisma.companySettings.upsert({
                        where: { key: setting.key },
                        update: { value: setting.value },
                        create: { key: setting.key, value: setting.value }
                    })];
            case 2:
                _d.sent();
                _d.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4:
                if (!Array.isArray(vehicles)) return [3 /*break*/, 15];
                return [4 /*yield*/, prisma.vehicle.updateMany({ data: { isActive: false } })];
            case 5:
                _d.sent();
                _b = 0, vehicles_2 = vehicles;
                _d.label = 6;
            case 6:
                if (!(_b < vehicles_2.length)) return [3 /*break*/, 15];
                v = vehicles_2[_b];
                if (!(v.id && typeof v.id === 'number')) return [3 /*break*/, 12];
                return [4 /*yield*/, prisma.vehicle.findUnique({
                        where: { id: v.id }
                    })];
            case 7:
                existingVehicle = _d.sent();
                if (!existingVehicle) return [3 /*break*/, 9];
                return [4 /*yield*/, prisma.vehicle.update({
                        where: { id: v.id },
                        data: { name: v.name, isActive: true }
                    })];
            case 8:
                _d.sent();
                return [3 /*break*/, 11];
            case 9: 
            // L'ID non esiste nel DB, crea un nuovo veicolo
            return [4 /*yield*/, prisma.vehicle.create({
                    data: { name: v.name, isActive: true }
                })];
            case 10:
                // L'ID non esiste nel DB, crea un nuovo veicolo
                _d.sent();
                _d.label = 11;
            case 11: return [3 /*break*/, 14];
            case 12: return [4 /*yield*/, prisma.vehicle.create({
                    data: { name: v.name, isActive: true }
                })];
            case 13:
                _d.sent();
                _d.label = 14;
            case 14:
                _b++;
                return [3 /*break*/, 6];
            case 15:
                if (!Array.isArray(holidays)) return [3 /*break*/, 20];
                return [4 /*yield*/, prisma.holiday.deleteMany({})];
            case 16:
                _d.sent();
                _c = 0, holidays_2 = holidays;
                _d.label = 17;
            case 17:
                if (!(_c < holidays_2.length)) return [3 /*break*/, 20];
                dateStr = holidays_2[_c];
                return [4 /*yield*/, prisma.holiday.create({
                        data: { date: new Date(dateStr + 'T00:00:00Z') }
                    })];
            case 18:
                _d.sent();
                _d.label = 19;
            case 19:
                _c++;
                return [3 /*break*/, 17];
            case 20:
                res.json({ message: 'Settings saved successfully' });
                return [3 /*break*/, 22];
            case 21:
                err_4 = _d.sent();
                errorMsg = err_4 instanceof Error ? err_4.message : 'Internal server error';
                console.error('Error saving settings:', errorMsg);
                res.status(500).json({ message: errorMsg });
                return [3 /*break*/, 22];
            case 22: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/settings/vehicles
 * Lista veicoli
 */
router.get('/vehicles', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var vehicles, err_5, errorMsg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, prisma.vehicle.findMany({
                        where: { isActive: true },
                        orderBy: { id: 'asc' }
                    })];
            case 1:
                vehicles = _a.sent();
                res.json(vehicles);
                return [3 /*break*/, 3];
            case 2:
                err_5 = _a.sent();
                errorMsg = err_5 instanceof Error ? err_5.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/settings/vehicles
 * Crea veicolo
 */
router.post('/vehicles', auth_1.authMiddleware, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name_1, plate, vehicle, err_6, errorMsg;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                if (!req.user || req.user.role !== 'master') {
                    return [2 /*return*/, res.status(403).json({ message: 'Only master can add vehicles' })];
                }
                _a = req.body, name_1 = _a.name, plate = _a.plate;
                return [4 /*yield*/, prisma.vehicle.create({
                        data: { name: name_1, plate: plate || null, isActive: true }
                    })];
            case 1:
                vehicle = _b.sent();
                res.status(201).json(vehicle);
                return [3 /*break*/, 3];
            case 2:
                err_6 = _b.sent();
                errorMsg = err_6 instanceof Error ? err_6.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * DELETE /api/settings/vehicles/:id
 * Elimina veicolo
 */
router.delete('/vehicles/:id', auth_1.authMiddleware, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, vehicleId, existingVehicle, err_7, errorMsg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                if (!req.user || req.user.role !== 'master') {
                    return [2 /*return*/, res.status(403).json({ message: 'Only master can delete vehicles' })];
                }
                id = req.params.id;
                vehicleId = parseInt(id);
                return [4 /*yield*/, prisma.vehicle.findUnique({
                        where: { id: vehicleId }
                    })];
            case 1:
                existingVehicle = _a.sent();
                if (!existingVehicle) {
                    return [2 /*return*/, res.status(404).json({ message: 'Vehicle not found' })];
                }
                return [4 /*yield*/, prisma.vehicle.update({
                        where: { id: vehicleId },
                        data: { isActive: false }
                    })];
            case 2:
                _a.sent();
                res.json({ success: true });
                return [3 /*break*/, 4];
            case 3:
                err_7 = _a.sent();
                errorMsg = err_7 instanceof Error ? err_7.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/settings/holidays
 * Lista festivi
 */
router.get('/holidays', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var holidays, err_8, errorMsg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, prisma.holiday.findMany({
                        orderBy: { date: 'asc' }
                    })];
            case 1:
                holidays = _a.sent();
                res.json(holidays.map(function (h) { return ({
                    id: h.id,
                    date: h.date.toISOString().split('T')[0],
                    description: h.description
                }); }));
                return [3 /*break*/, 3];
            case 2:
                err_8 = _a.sent();
                errorMsg = err_8 instanceof Error ? err_8.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/settings/holidays
 * Aggiungi festivo
 */
router.post('/holidays', auth_1.authMiddleware, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, date, description, holiday, err_9, errorMsg;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                if (!req.user || req.user.role !== 'master') {
                    return [2 /*return*/, res.status(403).json({ message: 'Only master can add holidays' })];
                }
                _a = req.body, date = _a.date, description = _a.description;
                return [4 /*yield*/, prisma.holiday.create({
                        data: {
                            date: new Date(date + 'T00:00:00Z'),
                            description: description || null
                        }
                    })];
            case 1:
                holiday = _b.sent();
                res.status(201).json({
                    id: holiday.id,
                    date: holiday.date.toISOString().split('T')[0],
                    description: holiday.description
                });
                return [3 /*break*/, 3];
            case 2:
                err_9 = _b.sent();
                errorMsg = err_9 instanceof Error ? err_9.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * DELETE /api/settings/holidays/:id
 * Elimina festivo
 */
router.delete('/holidays/:id', auth_1.authMiddleware, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, err_10, errorMsg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (!req.user || req.user.role !== 'master') {
                    return [2 /*return*/, res.status(403).json({ message: 'Only master can delete holidays' })];
                }
                id = req.params.id;
                return [4 /*yield*/, prisma.holiday.delete({
                        where: { id: parseInt(id) }
                    })];
            case 1:
                _a.sent();
                res.json({ success: true });
                return [3 /*break*/, 3];
            case 2:
                err_10 = _a.sent();
                errorMsg = err_10 instanceof Error ? err_10.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
