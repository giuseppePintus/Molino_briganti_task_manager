import { Router } from 'express';
import { InventoryController } from '../controllers/inventoryController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Tutte le route richiedono autenticazione
router.use(authMiddleware);

// Importazione dati
router.post('/import/articles', InventoryController.importArticles);
router.post('/import/shelf-positions', InventoryController.importShelfPositions);

// Lettura articoli
router.get('/articles', InventoryController.getAllArticles);
router.get('/articles/:id', InventoryController.getArticleDetail);

// Gestione stock
router.post('/stock/update', InventoryController.updateStock);
router.post('/stock/reduce', InventoryController.reduceStockForOrder);
router.post('/stock/set-minimum', InventoryController.setMinimumStock);

// Gestione posizioni scaffali
router.post('/shelf-position', InventoryController.updateShelfPosition);

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

export default router;
