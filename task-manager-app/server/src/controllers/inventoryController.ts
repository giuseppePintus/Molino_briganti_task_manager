import { Request, Response } from 'express';
import { InventoryService } from '../services/inventoryService';
import * as path from 'path';
import * as fs from 'fs';

const MASTER_CSV_PATH = '/share/Container/data/molino/master-Inventory.csv';

export class InventoryController {
  /**
   * Legge il CSV master e lo restituisce come JSON (senza Prisma)
   */
  static async readMasterCsvDirect(req: Request, res: Response) {
    try {
      if (!fs.existsSync(MASTER_CSV_PATH)) {
        return res.status(404).json({
          success: false,
          error: `CSV non trovato: ${MASTER_CSV_PATH}`
        });
      }

      const csv = require('csv-parse/sync');
      const content = fs.readFileSync(MASTER_CSV_PATH, 'utf-8');
      const records = csv.parse(content, { columns: true });

      res.json({
        success: true,
        count: records.length,
        data: records
      });
    } catch (error: any) {
      console.error('❌ CSV read error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**   * Importa inventario dal file CSV master sul NAS
   */
  static async importFromMasterCSV(req: Request, res: Response) {
    try {
      console.log('🔄 Richiesta import da Master CSV');
      const result = await InventoryService.importFromMasterCSV();
      res.json({
        success: true,
        message: 'Master CSV import completed',
        data: result
      });
    } catch (error: any) {
      console.error('❌ Master CSV import error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        hint: 'Verify MASTER_INVENTORY_CSV_PATH in .env file'
      });
    }
  }

  /**
   * Sincronizza il database al file CSV master
   */
  static async syncToMasterCsv(req: Request, res: Response) {
    try {
      console.log('🔄 Sincronizzazione al CSV master...');
      const result = await InventoryService.syncToMasterCSV();
      
      res.json({
        success: true,
        message: 'Sincronizzazione completata',
        data: result
      });
    } catch (error: any) {
      console.error('❌ Errore sincronizzazione:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Ottiene il file CSV master attuale
   */
  static async getMasterCsvFile(req: Request, res: Response) {
    try {
      const filePath = InventoryService.getMasterCsvPath();
      res.json({
        success: true,
        filePath: filePath
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Ottiene tutti gli articoli
   */
  static async getAllArticles(req: Request, res: Response) {
    try {
      const search = req.query.search as string | undefined;
      const articles = await InventoryService.getAllArticles(search);
      res.json(articles);
    } catch (error: any) {
      console.error('❌ Errore getAllArticles:', error);
      res.status(500).json({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Ottiene dettagli articolo
   */
  static async getArticleDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const article = await InventoryService.getArticleDetail(parseInt(id));
      
      if (!article) {
        return res.status(404).json({ error: 'Articolo non trovato' });
      }

      res.json(article);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Aggiorna stock manualmente
   */
  static async updateStock(req: Request, res: Response) {
    try {
      const { articleId, newQuantity, reason } = req.body;
      // Prova a ottenere l'userId dal middleware di autenticazione o dal body come fallback
      let userId = (req as any).user?.id;
      
      if (!userId) {
        // Fallback: usa un default user ID per test/operazioni locali
        userId = 1;
        console.log('⚠️ Nessun user nel token, usando ID fallback: 1');
      }

      if (!articleId || newQuantity === undefined) {
        return res.status(400).json({ error: 'Campi obbligatori: articleId, newQuantity' });
      }

      const updated = await InventoryService.updateStock(
        parseInt(articleId),
        parseInt(newQuantity),
        reason || 'AGGIUSTAMENTO MANUALE',
        userId
      );

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Imposta soglia minima per articolo
   */
  static async setMinimumStock(req: Request, res: Response) {
    try {
      const { articleId, minimumStock } = req.body;

      if (!articleId || minimumStock === undefined) {
        return res.status(400).json({ error: 'Campi obbligatori: articleId, minimumStock' });
      }

      const result = await InventoryService.setMinimumStock(
        parseInt(articleId),
        parseInt(minimumStock)
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Aggiorna posizione scaffale
   */
  static async updateShelfPosition(req: Request, res: Response) {
    try {
      const { articleId, shelfPosition } = req.body;

      if (!articleId || !shelfPosition) {
        return res.status(400).json({ error: 'Campi obbligatori: articleId, shelfPosition' });
      }

      const result = await InventoryService.updateShelfPosition(
        parseInt(articleId),
        shelfPosition
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  /**
   * Ottiene articoli in allarme
   */
  static async getArticlesOnAlert(req: Request, res: Response) {
    try {
      const alerts = await InventoryService.getArticlesOnAlert();
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Risolve un allarme
   */
  static async resolveAlert(req: Request, res: Response) {
    try {
      const { alertId } = req.params;

      const result = await InventoryService.resolveAlert(parseInt(alertId));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Esporta inventory in CSV
   */
  static async exportInventory(req: Request, res: Response) {
    try {
      const csv = await InventoryService.exportInventoryCSV();
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Esporta inventory in CSV formato standardizzato (compatibile con import)
   */
  static async exportInventoryStandardized(req: Request, res: Response) {
    try {
      const csv = await InventoryService.exportInventoryCSVStandardized();
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory-standardized.csv"');
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Riduce stock per ordine
   */
  static async reduceStockForOrder(req: Request, res: Response) {
    try {
      const { articleId, quantity } = req.body;
      let userId = (req as any).user?.id;
      
      if (!userId) {
        userId = 1; // Fallback per operazioni locali
        console.log('⚠️ Nessun user nel token, usando ID fallback: 1');
      }

      if (!articleId || !quantity) {
        return res.status(400).json({ error: 'Campi obbligatori: articleId, quantity' });
      }

      const result = await InventoryService.reduceStockForOrder(
        parseInt(articleId),
        parseInt(quantity),
        userId
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Ottiene lotti disponibili per un articolo
   */
  static async getBatches(req: Request, res: Response) {
    try {
      const { code } = req.query;
      
      if (!code) {
        return res.status(400).json({ error: 'Codice articolo obbligatorio' });
      }

      const batches = await InventoryService.getBatchesForArticle(code as string);
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Prenota quantità per ordine
   */
  static async reserveInventory(req: Request, res: Response) {
    try {
      const { code, quantity, orderId } = req.body;

      if (!code || !quantity || !orderId) {
        return res.status(400).json({ error: 'Campi obbligatori: code, quantity, orderId' });
      }

      const result = await InventoryService.reserveInventory(
        code as string,
        parseInt(quantity),
        orderId as string
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Libera prenotazione (quando ordine cancellato)
   */
  static async releaseReservation(req: Request, res: Response) {
    try {
      const { code, quantity } = req.body;

      if (!code || !quantity) {
        return res.status(400).json({ error: 'Campi obbligatori: code, quantity' });
      }

      const result = await InventoryService.releaseReservation(
        code as string,
        parseInt(quantity)
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Consuma inventario prenotato (quando ordine completato)
   */
  static async consumeReservedInventory(req: Request, res: Response) {
    try {
      const { code, quantity } = req.body;

      if (!code || !quantity) {
        return res.status(400).json({ error: 'Campi obbligatori: code, quantity' });
      }

      const result = await InventoryService.consumeReservedInventory(
        code as string,
        parseInt(quantity)
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Importa inventario dal PDF sul NAS
   * Azzerasii il master-Inventory.csv e lo ricrea dal PDF
   */
  static async importFromPdf(req: Request, res: Response) {
    try {
      console.log('📄 Richiesta import da PDF');
      const result = await InventoryService.importFromPdf();
      res.json({
        success: true,
        message: 'Import da PDF completato',
        data: result
      });
    } catch (error: any) {
      console.error('❌ PDF import error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        hint: 'Verifica che il file PDF sia accessibile: \\nas71f89c\Container\Inventory.pdf'
      });
    }
  }

  /**
   * Elimina un articolo (admin only)
   */
  static async deleteArticle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await InventoryService.deleteArticle(parseInt(id));
      res.json({
        success: true,
        message: 'Articolo eliminato'
      });
    } catch (error: any) {
      console.error('❌ Delete article error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}


