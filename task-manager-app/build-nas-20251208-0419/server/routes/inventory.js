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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventoryController_1 = require("../controllers/inventoryController");
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const path = __importStar(require("path"));
const router = (0, express_1.Router)();
// Configurazione multer per upload di CSV
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            const uploadsPath = path.join(process.cwd(), 'uploads');
            console.log('🗂️ Multer destination path:', uploadsPath);
            cb(null, uploadsPath);
        },
        filename: (req, file, cb) => {
            const filename = `inventory-${Date.now()}.csv`;
            console.log('📝 Multer filename:', filename, 'originalname:', file.originalname);
            cb(null, filename);
        }
    }),
    fileFilter: (req, file, cb) => {
        console.log('🔍 Multer fileFilter - mimetype:', file.mimetype, 'originalname:', file.originalname);
        // Accetta .csv con qualsiasi mimetype (alcuni client invia application/octet-stream)
        if (file.originalname.endsWith('.csv') || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.mimetype === 'application/octet-stream') {
            console.log('✅ File accettato');
            cb(null, true);
        }
        else {
            console.log('❌ File rifiutato');
            cb(new Error('Solo file CSV sono permettiti. Mimetype: ' + file.mimetype));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});
// Tutte le route richiedono autenticazione
router.use(auth_1.authMiddleware);
// Importazione dati - aggiungi error handler per multer
router.post('/import/articles', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('❌ Multer error:', err.message);
            return res.status(400).json({ error: 'Errore upload file: ' + err.message });
        }
        next();
    });
}, inventoryController_1.InventoryController.importArticles);
router.post('/import/shelf-positions', inventoryController_1.InventoryController.importShelfPositions);
// Lettura articoli
router.get('/articles', inventoryController_1.InventoryController.getAllArticles);
router.get('/articles/:id', inventoryController_1.InventoryController.getArticleDetail);
// Gestione stock
router.post('/stock/update', inventoryController_1.InventoryController.updateStock);
router.post('/stock/reduce', inventoryController_1.InventoryController.reduceStockForOrder);
router.post('/stock/set-minimum', inventoryController_1.InventoryController.setMinimumStock);
router.post('/reset-all', inventoryController_1.InventoryController.resetAllInventory);
// Gestione posizioni scaffali
router.post('/shelf-position', inventoryController_1.InventoryController.updateShelfPosition);
// Gestione prenotazioni (per ordini)
router.get('/batches', inventoryController_1.InventoryController.getBatches);
router.post('/reserve', inventoryController_1.InventoryController.reserveInventory);
router.post('/release', inventoryController_1.InventoryController.releaseReservation);
router.post('/consume', inventoryController_1.InventoryController.consumeReservedInventory);
// Allarmi
router.get('/alerts', inventoryController_1.InventoryController.getArticlesOnAlert);
router.post('/alerts/:alertId/resolve', inventoryController_1.InventoryController.resolveAlert);
// Esportazione
router.get('/export/csv', inventoryController_1.InventoryController.exportInventory);
exports.default = router;
