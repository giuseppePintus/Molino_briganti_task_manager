import { Request, Response } from 'express';
import { InventoryService } from '../services/inventoryService';
import * as path from 'path';

export class InventoryController {
  /**
   * Importa inventario da CSV
   */
  static async importArticles(req: Request, res: Response) {
    try {
      // Usa process.cwd() per avere il path assoluto corretto
      const csvPath = path.join(process.cwd(), 'public/data/inventory_data.csv');
      console.log('📥 Inizio importazione da:', csvPath);
      const result = await InventoryService.importInventoryFromCSV(csvPath);
      console.log('✅ Importazione completata:', result);
      res.json(result);
    } catch (error: any) {
      console.error('❌ Errore importazione:', error);
      res.status(500).json({ error: error.message, details: error.stack });
    }
  }

  /**
   * Importa posizioni scaffali
   */
  static async importShelfPositions(req: Request, res: Response) {
    try {
      const shelfPath = path.join(__dirname, '../../public/data/ELENCO POSIZIONI SCAFFALI.csv');
      const result = await InventoryService.importShelfPositions(shelfPath);
      res.json(result);
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
      res.status(500).json({ error: error.message });
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
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Non autorizzato' });
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
   * Riduce stock per ordine
   */
  static async reduceStockForOrder(req: Request, res: Response) {
    try {
      const { articleId, quantity } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Non autorizzato' });
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
}
