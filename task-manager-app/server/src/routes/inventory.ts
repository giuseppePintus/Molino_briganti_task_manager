import { Router } from 'express';
import { InventoryController } from '../controllers/inventoryController';
import { authMiddleware } from '../middleware/auth';
import multer from 'multer';
import * as path from 'path';

const router = Router();

// Configurazione multer per upload di CSV
const upload = multer({
  storage: multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
      const uploadsPath = path.join(process.cwd(), 'uploads');
      console.log('🗂️ Multer destination path:', uploadsPath);
      cb(null, uploadsPath);
    },
    filename: (req: any, file: any, cb: any) => {
      const filename = `inventory-${Date.now()}.csv`;
      console.log('📝 Multer filename:', filename, 'originalname:', file.originalname);
      cb(null, filename);
    }
  }),
  fileFilter: (req: any, file: any, cb: any) => {
    console.log('🔍 Multer fileFilter - mimetype:', file.mimetype, 'originalname:', file.originalname);
    // Accetta .csv con qualsiasi mimetype (alcuni client invia application/octet-stream)
    if (file.originalname.endsWith('.csv') || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.mimetype === 'application/octet-stream') {
      console.log('✅ File accettato');
      cb(null, true);
    } else {
      console.log('❌ File rifiutato');
      cb(new Error('Solo file CSV sono permettiti. Mimetype: ' + file.mimetype));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Tutte le route richiedono autenticazione
router.use(authMiddleware);

// Importazione dati - aggiungi error handler per multer
router.post('/import/articles', (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      console.error('❌ Multer error:', err.message);
      return res.status(400).json({ error: 'Errore upload file: ' + err.message });
    }
    next();
  });
}, InventoryController.importArticles);
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
