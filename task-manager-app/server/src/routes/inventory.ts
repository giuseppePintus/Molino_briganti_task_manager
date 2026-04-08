import { Router } from 'express';
import { InventoryController } from '../controllers/inventoryController';
import { authMiddleware } from '../middleware/auth';
import * as path from 'path';

const router = Router();

// Route pubblica - Import da Master CSV (non richiede autenticazione)
router.post('/import/master-csv', InventoryController.importFromMasterCSV);

// Route pubblica - Leggi Master CSV direttamente (senza Prisma)
router.get('/master-csv/data', InventoryController.readMasterCsvDirect);

// Route pubblica - Import da PDF (non richiede autenticazione)
router.post('/import/pdf', InventoryController.importFromPdf);

// Master CSV management
router.get('/get-master-csv', InventoryController.getMasterCsvFile);
router.post('/sync-to-csv', InventoryController.syncToMasterCsv);

// Lettura articoli
router.get('/articles', InventoryController.getAllArticles);
router.get('/articles/:id', InventoryController.getArticleDetail);
router.post('/articles', InventoryController.createArticle);
router.put('/articles/:id', InventoryController.updateArticle);
router.delete('/articles/:id', InventoryController.deleteArticle);

// Gestione stock
router.post('/stock/update', (req, res, next) => {
  console.log('📦 Ricevuta richiesta POST /api/inventory/stock/update');
  console.log('   Body:', JSON.stringify(req.body));
  next();
}, InventoryController.updateStock);
router.post('/stock/reduce', InventoryController.reduceStockForOrder);
router.post('/stock/set-minimum', InventoryController.setMinimumStock);


// Gestione posizioni scaffali
router.post('/shelf-position', InventoryController.updateShelfPosition);

// CRUD posizioni scaffale
router.get('/shelf-positions', InventoryController.getShelfPositions);
router.post('/shelf-positions', InventoryController.createShelfPosition);
router.put('/shelf-positions/:id', InventoryController.updateShelfPositionEntry);
router.delete('/shelf-positions/:id', InventoryController.deleteShelfPosition);
router.post('/shelf-positions/seed', InventoryController.seedShelfPositions);

// ShelfEntries (many-to-many: articolo x posizione)
router.get('/shelf-entries', InventoryController.getShelfEntries);
router.post('/shelf-entries', InventoryController.upsertShelfEntry);
router.put('/shelf-entries/:id', InventoryController.updateShelfEntry);
router.delete('/shelf-entries/:id', InventoryController.deleteShelfEntry);

// Gestione prenotazioni (per ordini)
router.get('/batches', InventoryController.getBatches);
router.post('/reserve', InventoryController.reserveInventory);
router.post('/release', InventoryController.releaseReservation);
router.post('/consume', InventoryController.consumeReservedInventory);

// Allarmi
router.get('/alerts', InventoryController.getArticlesOnAlert);
router.post('/alerts/:alertId/resolve', InventoryController.resolveAlert);

// Esportazione
router.get('/export/csv', InventoryController.exportInventory);
router.get('/export/csv-standardized', InventoryController.exportInventoryStandardized);

export default router;
