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
exports.InventoryController = void 0;
const inventoryService_1 = require("../services/inventoryService");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class InventoryController {
    /**
     * Importa inventario da CSV
     */
    static importArticles(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let csvPath;
                const file = req.file;
                const body = req.body;
                console.log('📨 Import request - file:', !!file);
                if (file) {
                    console.log('   📄 File details - fieldname:', file.fieldname, 'originalname:', file.originalname, 'path:', file.path, 'size:', file.size);
                }
                console.log('   📦 Body:', body);
                // Se è stato caricato un file tramite FormData
                if (file) {
                    csvPath = file.path;
                    console.log('📥 Importazione da file caricato:', csvPath);
                    // Verifica che il file esista
                    if (!fs.existsSync(csvPath)) {
                        console.error('❌ File caricato non esiste a:', csvPath);
                        return res.status(400).json({ error: 'File caricato non trovato' });
                    }
                }
                else {
                    // Fallback al file di default - usa path assoluto basato su __dirname
                    csvPath = path.join(__dirname, '../../public/data/inventory_data.csv');
                    console.log('📥 Importazione da file di default:', csvPath);
                    console.log('📁 Directory scanner (__dirname):', __dirname);
                    // Verifica se il file esiste
                    if (!fs.existsSync(csvPath)) {
                        console.warn('⚠️ File non trovato a:', csvPath);
                        // Prova alternate locations
                        const alternativePaths = [
                            path.join(process.cwd(), 'public/data/inventory_data.csv'),
                            path.join(__dirname, '../../../../public/data/inventory_data.csv'),
                            '/app/public/data/inventory_data.csv'
                        ];
                        for (const altPath of alternativePaths) {
                            console.log('🔍 Provo percorso alternativo:', altPath);
                            if (fs.existsSync(altPath)) {
                                csvPath = altPath;
                                console.log('✅ File trovato a:', csvPath);
                                break;
                            }
                        }
                        if (!fs.existsSync(csvPath)) {
                            throw new Error(`File inventario non trovato. Cercato: ${csvPath}`);
                        }
                    }
                    else {
                        console.log('✅ File trovato al primo tentativo:', csvPath);
                    }
                }
                const result = yield inventoryService_1.InventoryService.importInventoryFromCSV(csvPath);
                console.log('✅ Importazione completata:', result);
                // Se il file è stato caricato, eliminalo dopo l'importazione
                if (file && fs.existsSync(csvPath)) {
                    try {
                        fs.unlinkSync(csvPath);
                        console.log('🗑️ File temporaneo eliminato');
                    }
                    catch (err) {
                        console.warn('⚠️ Errore eliminazione file temporaneo:', err);
                    }
                }
                res.json(result);
            }
            catch (error) {
                console.error('❌ Errore importazione:', error);
                res.status(500).json({ error: error.message, details: error.stack });
            }
        });
    }
    /**
     * Importa posizioni scaffali
     */
    static importShelfPositions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const shelfPath = path.join(__dirname, '../../public/data/ELENCO POSIZIONI SCAFFALI.csv');
                const result = yield inventoryService_1.InventoryService.importShelfPositions(shelfPath);
                res.json(result);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Ottiene tutti gli articoli
     */
    static getAllArticles(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const search = req.query.search;
                const articles = yield inventoryService_1.InventoryService.getAllArticles(search);
                res.json(articles);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Ottiene dettagli articolo
     */
    static getArticleDetail(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const article = yield inventoryService_1.InventoryService.getArticleDetail(parseInt(id));
                if (!article) {
                    return res.status(404).json({ error: 'Articolo non trovato' });
                }
                res.json(article);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Aggiorna stock manualmente
     */
    static updateStock(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { articleId, newQuantity, reason } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return res.status(401).json({ error: 'Non autorizzato' });
                }
                if (!articleId || newQuantity === undefined) {
                    return res.status(400).json({ error: 'Campi obbligatori: articleId, newQuantity' });
                }
                const updated = yield inventoryService_1.InventoryService.updateStock(parseInt(articleId), parseInt(newQuantity), reason || 'AGGIUSTAMENTO MANUALE', userId);
                res.json(updated);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Imposta soglia minima per articolo
     */
    static setMinimumStock(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { articleId, minimumStock } = req.body;
                if (!articleId || minimumStock === undefined) {
                    return res.status(400).json({ error: 'Campi obbligatori: articleId, minimumStock' });
                }
                const result = yield inventoryService_1.InventoryService.setMinimumStock(parseInt(articleId), parseInt(minimumStock));
                res.json(result);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Aggiorna posizione scaffale
     */
    static updateShelfPosition(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { articleId, shelfPosition } = req.body;
                if (!articleId || !shelfPosition) {
                    return res.status(400).json({ error: 'Campi obbligatori: articleId, shelfPosition' });
                }
                const result = yield inventoryService_1.InventoryService.updateShelfPosition(parseInt(articleId), shelfPosition);
                res.json(result);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Ottiene articoli in allarme
     */
    static getArticlesOnAlert(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const alerts = yield inventoryService_1.InventoryService.getArticlesOnAlert();
                res.json(alerts);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Risolve un allarme
     */
    static resolveAlert(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { alertId } = req.params;
                const result = yield inventoryService_1.InventoryService.resolveAlert(parseInt(alertId));
                res.json(result);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Esporta inventory in CSV
     */
    static exportInventory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const csv = yield inventoryService_1.InventoryService.exportInventoryCSV();
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
                res.send(csv);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Riduce stock per ordine
     */
    static reduceStockForOrder(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { articleId, quantity } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return res.status(401).json({ error: 'Non autorizzato' });
                }
                if (!articleId || !quantity) {
                    return res.status(400).json({ error: 'Campi obbligatori: articleId, quantity' });
                }
                const result = yield inventoryService_1.InventoryService.reduceStockForOrder(parseInt(articleId), parseInt(quantity), userId);
                res.json(result);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Ottiene lotti disponibili per un articolo
     */
    static getBatches(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { code } = req.query;
                if (!code) {
                    return res.status(400).json({ error: 'Codice articolo obbligatorio' });
                }
                const batches = yield inventoryService_1.InventoryService.getBatchesForArticle(code);
                res.json(batches);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Prenota quantità per ordine
     */
    static reserveInventory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { code, quantity, orderId } = req.body;
                if (!code || !quantity || !orderId) {
                    return res.status(400).json({ error: 'Campi obbligatori: code, quantity, orderId' });
                }
                const result = yield inventoryService_1.InventoryService.reserveInventory(code, parseInt(quantity), orderId);
                res.json(result);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Libera prenotazione (quando ordine cancellato)
     */
    static releaseReservation(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { code, quantity } = req.body;
                if (!code || !quantity) {
                    return res.status(400).json({ error: 'Campi obbligatori: code, quantity' });
                }
                const result = yield inventoryService_1.InventoryService.releaseReservation(code, parseInt(quantity));
                res.json(result);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    /**
     * Consuma inventario prenotato (quando ordine completato)
     */
    static consumeReservedInventory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { code, quantity } = req.body;
                if (!code || !quantity) {
                    return res.status(400).json({ error: 'Campi obbligatori: code, quantity' });
                }
                const result = yield inventoryService_1.InventoryService.consumeReservedInventory(code, parseInt(quantity));
                res.json(result);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.InventoryController = InventoryController;
