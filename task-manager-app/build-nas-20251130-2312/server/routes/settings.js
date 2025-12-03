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
const router = (0, express_1.Router)();
// Tutte le route richiedono autenticazione
router.use(auth_1.authMiddleware);
// GET settings
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'master') {
            return res.status(403).json({ message: 'Only master can view settings' });
        }
        // Ritorna configurazioni di default
        res.json({
            company: {
                name: 'Molino Briganti',
                email: 'info@molinobriganti.it',
                phone: '+39 XXX XXX XXXX',
                address: 'Via Molino Briganti, X, Italia',
            },
            backup: {
                enabled: true,
                interval: 60,
                retention: 30,
            },
            notifications: {
                email: true,
                sms: false,
                push: true,
            },
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ message: errorMsg });
    }
}));
// UPDATE settings
router.put('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== 'master') {
            return res.status(403).json({ message: 'Only master can update settings' });
        }
        // Salva le nuove impostazioni (in produzione salvare su database)
        const { company, backup, notifications } = req.body;
        res.json({
            message: 'Settings updated successfully',
            data: {
                company,
                backup,
                notifications,
            },
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ message: errorMsg });
    }
}));
exports.default = router;
