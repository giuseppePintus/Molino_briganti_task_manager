import { Request, Response } from 'express';
import { InventoryService } from '../services/inventoryService';
import { socketService, SocketEvents } from '../services/socketService';
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
      const { articleId, newQuantity, reason, batch, expiry } = req.body;
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
        userId,
        batch,
        expiry
      );

      socketService.broadcast(SocketEvents.INVENTORY_UPDATED, { type: 'stock', articleId });
      res.json(updated);
    } catch (error: any) {
      console.error('❌ updateStock ERROR:', error?.message || error);
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
   * Reset tutte le prenotazioni a 0 (utile quando ordini eliminati senza rilascio)
   */
  static async resetAllReservations(req: Request, res: Response) {
    try {
      const result = await InventoryService.resetAllReservations();
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
   * Crea un nuovo articolo
   */
  static async createArticle(req: Request, res: Response) {
    try {
      const { code, name, description, category, unit, weightPerUnit, barcode } = req.body;
      if (!code || !name) {
        return res.status(400).json({ success: false, error: 'Codice e nome sono obbligatori' });
      }
      const article = await InventoryService.createArticle({ code, name, description, category, unit, weightPerUnit: weightPerUnit ? parseFloat(weightPerUnit) : undefined, barcode });
      res.json({ success: true, data: article });
    } catch (error: any) {
      console.error('❌ Create article error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Aggiorna un articolo esistente
   */
  static async updateArticle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { code, name, description, category, unit, weightPerUnit, barcode } = req.body;
      const article = await InventoryService.updateArticle(parseInt(id), { code, name, description, category, unit, weightPerUnit: weightPerUnit !== undefined ? parseFloat(weightPerUnit) : undefined, barcode });
      res.json({ success: true, data: article });
    } catch (error: any) {
      console.error('❌ Update article error:', error);
      res.status(500).json({ success: false, error: error.message });
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

  // =============================================
  // SHELF POSITIONS
  // =============================================

  static async getShelfPositions(req: Request, res: Response) {
    try {
      const positions = await InventoryService.getShelfPositions();
      res.json(positions);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createShelfPosition(req: Request, res: Response) {
    try {
      const { code, description } = req.body;
      if (!code) {
        return res.status(400).json({ success: false, error: 'Il codice è obbligatorio' });
      }
      const position = await InventoryService.createShelfPosition(code, description);
      res.json({ success: true, data: position });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async updateShelfPositionEntry(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { code, description, isActive } = req.body;
      const position = await InventoryService.updateShelfPositionEntry(parseInt(id), { code, description, isActive });
      res.json({ success: true, data: position });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ success: false, error: `Il codice posizione "${req.body.code}" è già in uso.` });
      }
      console.error('❌ Errore update posizione:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async deleteShelfPosition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await InventoryService.deleteShelfPosition(parseInt(id));
      res.json({ success: true, message: 'Posizione eliminata' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async seedShelfPositions(req: Request, res: Response) {
    try {
      const { positions } = req.body;
      if (!positions || !Array.isArray(positions)) {
        return res.status(400).json({ success: false, error: 'Array posizioni richiesto' });
      }
      const result = await InventoryService.seedShelfPositions(positions);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // =============================================
  // SHELF ENTRIES
  // =============================================

  static async getShelfEntries(req: Request, res: Response) {
    try {
      const { articleId, positionCode } = req.query;
      const entries = await InventoryService.getShelfEntries({
        articleId: articleId ? parseInt(articleId as string) : undefined,
        positionCode: positionCode as string | undefined
      });
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async upsertShelfEntry(req: Request, res: Response) {
    try {
      const { articleId, positionCode, quantity, batch, expiry, notes } = req.body;
      if (!articleId || !positionCode) {
        return res.status(400).json({ success: false, error: 'articleId e positionCode obbligatori' });
      }
      const entry = await InventoryService.upsertShelfEntry({
        articleId: parseInt(articleId),
        positionCode,
        quantity: quantity !== undefined ? parseInt(quantity) : 0,
        batch: batch || undefined,
        expiry: expiry || undefined,
        notes: notes || undefined
      });
      socketService.broadcast(SocketEvents.INVENTORY_UPDATED, { type: 'shelf-entry' });
      res.json({ success: true, data: entry });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async updateShelfEntry(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { quantity, batch, expiry, notes, positionCode } = req.body;
      const entry = await InventoryService.updateShelfEntry(parseInt(id), {
        ...(quantity !== undefined && { quantity: parseInt(quantity) }),
        ...(batch !== undefined && { batch: batch || null }),
        ...(expiry !== undefined && { expiry: expiry || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(positionCode && { positionCode })
      });
      socketService.broadcast(SocketEvents.INVENTORY_UPDATED, { type: 'shelf-entry', id });
      res.json({ success: true, data: entry });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ success: false, error: 'Questo articolo è già presente in quella posizione scaffale.' });
      }
      console.error('❌ Errore update shelf entry:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async deleteShelfEntry(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await InventoryService.deleteShelfEntry(parseInt(id));
      socketService.broadcast(SocketEvents.INVENTORY_UPDATED, { type: 'shelf-entry', id });
      res.json({ success: true, message: 'Entrata rimossa' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

