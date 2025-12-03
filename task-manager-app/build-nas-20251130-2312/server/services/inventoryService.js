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
exports.InventoryService = void 0;
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
class InventoryService {
    /**
     * Parsing CSV - gestisce correttamente quote e virgole
     */
    static parseCSVLine(line) {
        const result = [];
        let current = '';
        let insideQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    // "" inside quotes = escaped quote
                    current += '"';
                    i++;
                }
                else {
                    // Toggle quote mode
                    insideQuotes = !insideQuotes;
                }
            }
            else if (char === ',' && !insideQuotes) {
                // Comma outside quotes = delimiter
                result.push(current.trim());
                current = '';
            }
            else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }
    /**
     * Importa dati inventario da file CSV
     */
    static importInventoryFromCSV(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('📄 Lettura file CSV da:', filePath);
                let fileContent = fs.readFileSync(filePath, 'utf-8');
                // Normalizza line endings (CRLF -> LF)
                fileContent = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                const lines = fileContent.trim().split('\n');
                console.log(`📊 CSV contiene ${lines.length} righe`);
                // Salta header
                if (lines.length === 0)
                    return { success: false, imported: 0 };
                const headers = this.parseCSVLine(lines[0]);
                console.log('📋 Headers:', headers);
                console.log('📈 Numero di colonne:', headers.length);
                let importedCount = 0;
                let updatedCount = 0;
                let skippedCount = 0;
                let errorCount = 0;
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim()) {
                        skippedCount++;
                        continue;
                    }
                    const values = this.parseCSVLine(line);
                    const data = {};
                    headers.forEach((header, index) => {
                        data[header] = values[index] || '';
                    });
                    console.log(`📍 Riga ${i}: Posizione=${data['Posizione']}, Codice=${data['Codice']}, Quantita=${data['Quantita']}`);
                    // Estrai i dati
                    const posizione = data['Posizione'];
                    const nome = data['Nome'];
                    const codice = data['Codice'];
                    const lotto = data['Lotto'];
                    const scadenza = data['Scadenza'];
                    const quantita = parseInt(data['Quantita']) || 0;
                    const annotazioni = data['Annotazioni'];
                    if (!codice || codice === '') {
                        skippedCount++;
                        continue; // Salta righe vuote
                    }
                    try {
                        // Ricerca articolo per codice
                        let article = yield prisma.article.findFirst({
                            where: { code: codice },
                            include: { inventory: true }
                        });
                        if (!article) {
                            // Se articolo non esiste, crealo
                            article = yield prisma.article.create({
                                data: {
                                    code: codice,
                                    name: nome || 'Sconosciuto',
                                    category: this.getCategoryFromCode(codice),
                                    unit: 'kg',
                                    inventory: {
                                        create: {
                                            currentStock: quantita,
                                            minimumStock: 5,
                                            shelfPosition: posizione,
                                            batch: lotto,
                                            expiry: scadenza,
                                            notes: annotazioni
                                        }
                                    }
                                },
                                include: { inventory: true }
                            });
                            importedCount++;
                            console.log(`✅ Importato articolo ${i}: ${codice} (${nome}) - Quantita: ${quantita}`);
                        }
                        else if (article.inventory) {
                            // Se articolo esiste, aggiorna l'inventario
                            yield prisma.inventory.update({
                                where: { id: article.inventory.id },
                                data: {
                                    currentStock: article.inventory.currentStock + quantita,
                                    shelfPosition: posizione,
                                    batch: lotto,
                                    expiry: scadenza,
                                    notes: annotazioni
                                }
                            });
                            updatedCount++;
                            console.log(`🔄 Aggiornato articolo ${i}: ${codice} - Quantita aggiunta: ${quantita}`);
                        }
                        else {
                            console.warn(`⚠️ Riga ${i} (${codice}): Articolo trovato ma senza inventory record`);
                            skippedCount++;
                        }
                    }
                    catch (err) {
                        console.error(`❌ Errore import riga ${i} (${codice}):`, err);
                        errorCount++;
                    }
                }
                console.log(`📈 Importazione completata: ${importedCount} importati, ${updatedCount} aggiornati, ${skippedCount} saltati, ${errorCount} errori`);
                return {
                    success: true,
                    imported: importedCount,
                    updated: updatedCount,
                    skipped: skippedCount,
                    errors: errorCount,
                    total: importedCount + updatedCount
                };
            }
            catch (error) {
                console.error('🔥 Errore fatale importazione:', error);
                throw new Error(`Errore importazione inventario: ${error}`);
            }
        });
    }
    /**
     * Importa posizioni scaffali
     */
    static importShelfPositions(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const lines = fileContent.trim().split('\n');
                const positions = lines.filter((line) => line.trim());
                // Per ora crea un mapping di posizioni disponibili
                return { success: true, positions: positions.length };
            }
            catch (error) {
                throw new Error(`Errore importazione posizioni scaffali: ${error}`);
            }
        });
    }
    /**
     * Ottiene categoria dal codice articolo
     */
    static getCategoryFromCode(code) {
        if (code.startsWith('F-'))
            return 'FARINE';
        if (code.startsWith('FM-'))
            return 'MIX FARINE';
        if (code.startsWith('GD-'))
            return 'SEMOLE';
        if (code.startsWith('Z-'))
            return 'CEREALI';
        if (code.startsWith('MG-'))
            return 'MANGIMI';
        if (code.startsWith('CP-'))
            return 'CEREALI PERLATI';
        return 'ALTRO';
    }
    /**
     * Ricava unità di misura dal nome
     */
    static getUnitFromName(name) {
        if (name.includes('kg') || name.includes('Kg'))
            return 'kg';
        if (name.includes('SFUSA') || name.includes('RINFUSA'))
            return 'SFUSO';
        return 'kg';
    }
    /**
     * Aggiorna stock per un articolo
     */
    static updateStock(articleId, newQuantity, reason, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const inventory = yield prisma.inventory.findUnique({
                    where: { articleId },
                    include: { article: true }
                });
                if (!inventory) {
                    throw new Error('Articolo non trovato');
                }
                const oldQuantity = inventory.currentStock;
                const difference = newQuantity - oldQuantity;
                // Aggiorna stock
                const updated = yield prisma.inventory.update({
                    where: { articleId },
                    data: { currentStock: newQuantity },
                    include: { article: true }
                });
                // Registra movimento
                yield prisma.stockMovement.create({
                    data: {
                        inventoryId: inventory.id,
                        type: difference > 0 ? 'IN' : 'OUT',
                        quantity: Math.abs(difference),
                        reason,
                        createdBy: userId
                    }
                });
                // Verifica se scatta un allarme
                if (newQuantity < inventory.minimumStock && oldQuantity >= inventory.minimumStock) {
                    yield this.createStockAlert(articleId, inventory.id, 'LOW_STOCK', newQuantity, inventory.minimumStock);
                }
                return updated;
            }
            catch (error) {
                throw new Error(`Errore aggiornamento stock: ${error}`);
            }
        });
    }
    /**
     * Riduce stock per ordine
     */
    static reduceStockForOrder(articleId, quantity, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const inventory = yield prisma.inventory.findUnique({
                    where: { articleId }
                });
                if (!inventory) {
                    throw new Error('Articolo non trovato');
                }
                const newQuantity = Math.max(0, inventory.currentStock - quantity);
                return yield this.updateStock(articleId, newQuantity, 'ORDINE', userId);
            }
            catch (error) {
                throw new Error(`Errore riduzione stock ordine: ${error}`);
            }
        });
    }
    /**
     * Crea allarme scorta
     */
    static createStockAlert(articleId, inventoryId, type, currentStock, minimumStock) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Controlla se esiste già un allarme non risolto
                const existing = yield prisma.stockAlert.findFirst({
                    where: {
                        articleId,
                        alertType: type,
                        isResolved: false
                    }
                });
                if (existing) {
                    return existing;
                }
                return yield prisma.stockAlert.create({
                    data: {
                        articleId,
                        inventoryId,
                        alertType: type,
                        currentStock,
                        minimumStock
                    },
                    include: { article: true }
                });
            }
            catch (error) {
                throw new Error(`Errore creazione allarme: ${error}`);
            }
        });
    }
    /**
     * Imposta soglia minima per un articolo
     */
    static setMinimumStock(articleId, minimumStock) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const inventory = yield prisma.inventory.update({
                    where: { articleId },
                    data: { minimumStock },
                    include: { article: true }
                });
                // Se lo stock attuale è già sotto il nuovo minimo, crea allarme
                if (inventory.currentStock < minimumStock) {
                    yield this.createStockAlert(articleId, inventory.id, 'LOW_STOCK', inventory.currentStock, minimumStock);
                }
                return inventory;
            }
            catch (error) {
                throw new Error(`Errore impostazione soglia minima: ${error}`);
            }
        });
    }
    /**
     * Ottiene posizione scaffale per articolo
     */
    static updateShelfPosition(articleId, shelfPosition) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield prisma.inventory.update({
                    where: { articleId },
                    data: { shelfPosition },
                    include: { article: true }
                });
            }
            catch (error) {
                throw new Error(`Errore aggiornamento posizione scaffale: ${error}`);
            }
        });
    }
    /**
     * Risolve un allarme
     */
    static resolveAlert(alertId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield prisma.stockAlert.update({
                    where: { id: alertId },
                    data: { isResolved: true, resolvedAt: new Date() },
                    include: { article: true, inventory: true }
                });
            }
            catch (error) {
                throw new Error(`Errore risoluzione allarme: ${error}`);
            }
        });
    }
    /**
     * Ottiene tutti gli articoli con inventory
     */
    static getAllArticles(search) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield prisma.article.findMany({
                    where: search ? {
                        OR: [
                            { code: { contains: search } },
                            { name: { contains: search } },
                            { category: { contains: search } }
                        ]
                    } : undefined,
                    include: {
                        inventory: {
                            include: { alerts: { where: { isResolved: false } } }
                        }
                    },
                    orderBy: { code: 'asc' }
                });
            }
            catch (error) {
                throw new Error(`Errore lettura articoli: ${error}`);
            }
        });
    }
    /**
     * Ottiene dettagli articolo
     */
    static getArticleDetail(articleId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield prisma.article.findUnique({
                    where: { id: articleId },
                    include: {
                        inventory: {
                            include: {
                                movements: { orderBy: { createdAt: 'desc' }, take: 20 },
                                alerts: { orderBy: { createdAt: 'desc' } }
                            }
                        }
                    }
                });
            }
            catch (error) {
                throw new Error(`Errore lettura dettagli articolo: ${error}`);
            }
        });
    }
    /**
     * Ottiene articoli in allarme
     */
    static getArticlesOnAlert() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield prisma.stockAlert.findMany({
                    where: { isResolved: false },
                    include: {
                        article: true,
                        inventory: true
                    },
                    orderBy: { createdAt: 'desc' }
                });
            }
            catch (error) {
                throw new Error(`Errore lettura allarmi: ${error}`);
            }
        });
    }
    /**
     * Esporta inventory in CSV
     */
    static exportInventoryCSV() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const articles = yield prisma.article.findMany({
                    include: { inventory: { include: { alerts: { where: { isResolved: false } } } } }
                });
                let csv = 'Codice,Descrizione,Categoria,Quantità,Minimo,Posizione Scaffale,Stato\n';
                for (const article of articles) {
                    const inv = article.inventory;
                    const status = inv && inv.currentStock < inv.minimumStock ? 'ALLARME' : 'OK';
                    csv += `${article.code},"${article.name}",${article.category || ''},${(inv === null || inv === void 0 ? void 0 : inv.currentStock) || 0},${(inv === null || inv === void 0 ? void 0 : inv.minimumStock) || 0},"${(inv === null || inv === void 0 ? void 0 : inv.shelfPosition) || ''}",${status}\n`;
                }
                return csv;
            }
            catch (error) {
                throw new Error(`Errore esportazione inventory: ${error}`);
            }
        });
    }
    /**
     * Ottiene i lotti disponibili per un articolo
     */
    static getBatchesForArticle(articleCode) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Leggi da inventory_data.csv per ottenere tutti i lotti dell'articolo
                const csvPath = path.join(process.cwd(), 'public/data/inventory_data.csv');
                const fileContent = fs.readFileSync(csvPath, 'utf-8');
                const lines = fileContent.trim().split('\n');
                if (lines.length === 0) {
                    throw new Error('File inventario vuoto');
                }
                // Salta header
                const headers = lines[0].split(',').map(h => h.trim());
                const posIdx = headers.indexOf('Posizione');
                const nomeIdx = headers.indexOf('Nome');
                const codiceIdx = headers.indexOf('Codice');
                const lottoIdx = headers.indexOf('Lotto');
                const scadenzaIdx = headers.indexOf('Scadenza');
                const quantitaIdx = headers.indexOf('Quantita');
                const annotazioniIdx = headers.indexOf('Annotazioni');
                const batches = [];
                const descrizioniByCode = {}; // Cache delle descrizioni
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim())
                        continue;
                    const values = line.split(',').map(v => v.trim());
                    const codice = values[codiceIdx] || '';
                    if (codice === articleCode) {
                        const lotto = values[lottoIdx] || '';
                        const scadenza = values[scadenzaIdx] || '';
                        const quantitaColli = parseInt(values[quantitaIdx]) || 0;
                        const posizione = values[posIdx] || '';
                        const annotazioni = values[annotazioniIdx] || '';
                        const nome = values[nomeIdx] || '';
                        // Cache la descrizione
                        descrizioniByCode[codice] = nome;
                        // Estrai peso da descrizione (es: "25kg" o "5 kg" da "FARINA 00 SFOGLIA da 25kg")
                        const pesoMatch = nome.match(/(\d+)\s*kg/i);
                        const pesoUnitario = pesoMatch ? parseInt(pesoMatch[1]) : 1;
                        const quantitaKg = quantitaColli * pesoUnitario;
                        // Aggiungi il lotto se non è già presente nella lista
                        if (!batches.some(b => b.batch === lotto && b.expiry === scadenza)) {
                            batches.push({
                                batch: lotto,
                                expiry: scadenza,
                                quantity: quantitaColli, // Numero di colli
                                quantityKg: quantitaKg, // Totale in kg
                                shelfPosition: posizione,
                                notes: annotazioni
                            });
                        }
                    }
                }
                // Ordina per scadenza (più vecchio primo) - lotti più vecchi come default
                batches.sort((a, b) => {
                    const dateA = this.parseDate(a.expiry);
                    const dateB = this.parseDate(b.expiry);
                    return dateA.getTime() - dateB.getTime();
                });
                return batches;
            }
            catch (error) {
                throw new Error(`Errore lettura lotti: ${error}`);
            }
        });
    }
    /**
     * Utility per parsare date formato DD/MM/YYYY
     */
    static parseDate(dateStr) {
        if (!dateStr || dateStr === '0')
            return new Date(9999, 11, 31); // Data molto futura per batch vecchi
        const parts = dateStr.split('/');
        if (parts.length !== 3)
            return new Date(9999, 11, 31);
        const [day, month, year] = parts.map(p => parseInt(p));
        return new Date(year, month - 1, day);
    }
    /**
     * Prenota quantità per un ordine
     */
    static reserveInventory(articleCode, quantity, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const article = yield prisma.article.findFirst({
                    where: { code: articleCode },
                    include: { inventory: true }
                });
                if (!article || !article.inventory) {
                    throw new Error('Articolo non trovato');
                }
                const inv = article.inventory;
                const reserved = (inv.reserved || 0) + quantity;
                const available = (inv.currentStock || 0) - reserved;
                if (available < 0) {
                    throw new Error(`Quantità insufficiente: disponibili ${inv.currentStock || 0} - già prenotati ${inv.reserved || 0}`);
                }
                // Aggiorna il campo reserved
                const updated = yield prisma.inventory.update({
                    where: { id: inv.id },
                    data: { reserved }
                });
                return { success: true, reserved, available, quantity };
            }
            catch (error) {
                throw new Error(`Errore prenotazione inventario: ${error}`);
            }
        });
    }
    /**
     * Libera prenotazione di un ordine (quando cancellato)
     */
    static releaseReservation(articleCode, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const article = yield prisma.article.findFirst({
                    where: { code: articleCode },
                    include: { inventory: true }
                });
                if (!article || !article.inventory) {
                    throw new Error('Articolo non trovato');
                }
                const inv = article.inventory;
                const reserved = Math.max(0, (inv.reserved || 0) - quantity);
                const updated = yield prisma.inventory.update({
                    where: { id: inv.id },
                    data: { reserved }
                });
                return { success: true, reserved };
            }
            catch (error) {
                throw new Error(`Errore rilascio prenotazione: ${error}`);
            }
        });
    }
    /**
     * Consuma inventario prenotato (quando ordine completato)
     */
    static consumeReservedInventory(articleCode, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const article = yield prisma.article.findFirst({
                    where: { code: articleCode },
                    include: { inventory: true }
                });
                if (!article || !article.inventory) {
                    throw new Error('Articolo non trovato');
                }
                const inv = article.inventory;
                const reserved = Math.max(0, (inv.reserved || 0) - quantity);
                const currentStock = Math.max(0, (inv.currentStock || 0) - quantity);
                const updated = yield prisma.inventory.update({
                    where: { id: inv.id },
                    data: { reserved, currentStock }
                });
                return { success: true, reserved, currentStock };
            }
            catch (error) {
                throw new Error(`Errore consumo inventario: ${error}`);
            }
        });
    }
}
exports.InventoryService = InventoryService;
