import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

export class InventoryService {
  /**
   * Importa dati inventario da file CSV
   */
  static async importInventoryFromCSV(filePath: string) {
    try {
      console.log('📄 Lettura file CSV da:', filePath);
      let fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Normalizza line endings (CRLF -> LF)
      fileContent = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      const lines = fileContent.trim().split('\n');
      
      console.log(`📊 CSV contiene ${lines.length} righe`);
      
      // Salta header
      if (lines.length === 0) return { success: false, imported: 0 };
      
      const headers = lines[0].split(',').map(h => h.trim());
      console.log('📋 Headers:', headers);
      
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) {
          skippedCount++;
          continue;
        }

        const values = line.split(',').map(v => v.trim());
        const data: any = {};
        
        headers.forEach((header, index) => {
          data[header] = values[index] || '';
        });

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
          let article = await prisma.article.findFirst({
            where: { code: codice },
            include: { inventory: true }
          });

          if (!article) {
            // Se articolo non esiste, crealo
            article = await prisma.article.create({
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
            console.log(`✅ Importato articolo ${i}: ${codice} (${nome})`);
          } else if (article.inventory) {
            // Se articolo esiste, aggiorna l'inventario
            await prisma.inventory.update({
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
            console.log(`🔄 Aggiornato articolo ${i}: ${codice}`);
          }
        } catch (err) {
          console.error(`❌ Errore import riga ${i} (${codice}):`, err);
        }
      }

      console.log(`📈 Importazione completata: ${importedCount} importati, ${updatedCount} aggiornati, ${skippedCount} saltati`);
      return { 
        success: true, 
        imported: importedCount,
        updated: updatedCount,
        skipped: skippedCount,
        total: importedCount + updatedCount
      };
    } catch (error) {
      console.error('🔥 Errore fatale importazione:', error);
      throw new Error(`Errore importazione inventario: ${error}`);
    }
  }

  /**
   * Importa posizioni scaffali
   */
  static async importShelfPositions(filePath: string) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.trim().split('\n');
      const positions = lines.filter((line: string) => line.trim());

      // Per ora crea un mapping di posizioni disponibili
      return { success: true, positions: positions.length };
    } catch (error) {
      throw new Error(`Errore importazione posizioni scaffali: ${error}`);
    }
  }

  /**
   * Ottiene categoria dal codice articolo
   */
  private static getCategoryFromCode(code: string): string {
    if (code.startsWith('F-')) return 'FARINE';
    if (code.startsWith('FM-')) return 'MIX FARINE';
    if (code.startsWith('GD-')) return 'SEMOLE';
    if (code.startsWith('Z-')) return 'CEREALI';
    if (code.startsWith('MG-')) return 'MANGIMI';
    if (code.startsWith('CP-')) return 'CEREALI PERLATI';
    return 'ALTRO';
  }

  /**
   * Ricava unità di misura dal nome
   */
  private static getUnitFromName(name: string): string {
    if (name.includes('kg') || name.includes('Kg')) return 'kg';
    if (name.includes('SFUSA') || name.includes('RINFUSA')) return 'SFUSO';
    return 'kg';
  }

  /**
   * Aggiorna stock per un articolo
   */
  static async updateStock(articleId: number, newQuantity: number, reason: string, userId: number) {
    try {
      const inventory = await prisma.inventory.findUnique({
        where: { articleId },
        include: { article: true }
      });

      if (!inventory) {
        throw new Error('Articolo non trovato');
      }

      const oldQuantity = inventory.currentStock;
      const difference = newQuantity - oldQuantity;

      // Aggiorna stock
      const updated = await prisma.inventory.update({
        where: { articleId },
        data: { currentStock: newQuantity },
        include: { article: true }
      });

      // Registra movimento
      await prisma.stockMovement.create({
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
        await this.createStockAlert(articleId, inventory.id, 'LOW_STOCK', newQuantity, inventory.minimumStock);
      }

      return updated;
    } catch (error) {
      throw new Error(`Errore aggiornamento stock: ${error}`);
    }
  }

  /**
   * Riduce stock per ordine
   */
  static async reduceStockForOrder(articleId: number, quantity: number, userId: number) {
    try {
      const inventory = await prisma.inventory.findUnique({
        where: { articleId }
      });

      if (!inventory) {
        throw new Error('Articolo non trovato');
      }

      const newQuantity = Math.max(0, inventory.currentStock - quantity);
      return await this.updateStock(articleId, newQuantity, 'ORDINE', userId);
    } catch (error) {
      throw new Error(`Errore riduzione stock ordine: ${error}`);
    }
  }

  /**
   * Crea allarme scorta
   */
  static async createStockAlert(articleId: number, inventoryId: number, type: string, currentStock: number, minimumStock: number) {
    try {
      // Controlla se esiste già un allarme non risolto
      const existing = await prisma.stockAlert.findFirst({
        where: {
          articleId,
          alertType: type,
          isResolved: false
        }
      });

      if (existing) {
        return existing;
      }

      return await prisma.stockAlert.create({
        data: {
          articleId,
          inventoryId,
          alertType: type,
          currentStock,
          minimumStock
        },
        include: { article: true }
      });
    } catch (error) {
      throw new Error(`Errore creazione allarme: ${error}`);
    }
  }

  /**
   * Imposta soglia minima per un articolo
   */
  static async setMinimumStock(articleId: number, minimumStock: number) {
    try {
      const inventory = await prisma.inventory.update({
        where: { articleId },
        data: { minimumStock },
        include: { article: true }
      });

      // Se lo stock attuale è già sotto il nuovo minimo, crea allarme
      if (inventory.currentStock < minimumStock) {
        await this.createStockAlert(articleId, inventory.id, 'LOW_STOCK', inventory.currentStock, minimumStock);
      }

      return inventory;
    } catch (error) {
      throw new Error(`Errore impostazione soglia minima: ${error}`);
    }
  }

  /**
   * Ottiene posizione scaffale per articolo
   */
  static async updateShelfPosition(articleId: number, shelfPosition: string) {
    try {
      return await prisma.inventory.update({
        where: { articleId },
        data: { shelfPosition },
        include: { article: true }
      });
    } catch (error) {
      throw new Error(`Errore aggiornamento posizione scaffale: ${error}`);
    }
  }

  /**
   * Risolve un allarme
   */
  static async resolveAlert(alertId: number) {
    try {
      return await prisma.stockAlert.update({
        where: { id: alertId },
        data: { isResolved: true, resolvedAt: new Date() },
        include: { article: true, inventory: true }
      });
    } catch (error) {
      throw new Error(`Errore risoluzione allarme: ${error}`);
    }
  }

  /**
   * Ottiene tutti gli articoli con inventory
   */
  static async getAllArticles(search?: string) {
    try {
      return await prisma.article.findMany({
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
    } catch (error) {
      throw new Error(`Errore lettura articoli: ${error}`);
    }
  }

  /**
   * Ottiene dettagli articolo
   */
  static async getArticleDetail(articleId: number) {
    try {
      return await prisma.article.findUnique({
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
    } catch (error) {
      throw new Error(`Errore lettura dettagli articolo: ${error}`);
    }
  }

  /**
   * Ottiene articoli in allarme
   */
  static async getArticlesOnAlert() {
    try {
      return await prisma.stockAlert.findMany({
        where: { isResolved: false },
        include: {
          article: true,
          inventory: true
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      throw new Error(`Errore lettura allarmi: ${error}`);
    }
  }

  /**
   * Esporta inventory in CSV
   */
  static async exportInventoryCSV(): Promise<string> {
    try {
      const articles = await prisma.article.findMany({
        include: { inventory: { include: { alerts: { where: { isResolved: false } } } } }
      });

      let csv = 'Codice,Descrizione,Categoria,Quantità,Minimo,Posizione Scaffale,Stato\n';

      for (const article of articles) {
        const inv = article.inventory;
        const status = inv && inv.currentStock < inv.minimumStock ? 'ALLARME' : 'OK';
        
        csv += `${article.code},"${article.name}",${article.category || ''},${inv?.currentStock || 0},${inv?.minimumStock || 0},"${inv?.shelfPosition || ''}",${status}\n`;
      }

      return csv;
    } catch (error) {
      throw new Error(`Errore esportazione inventory: ${error}`);
    }
  }

  /**
   * Ottiene i lotti disponibili per un articolo
   */
  static async getBatchesForArticle(articleCode: string) {
    try {
      const article = await prisma.article.findFirst({
        where: { code: articleCode },
        include: { inventory: true }
      });

      if (!article) {
        throw new Error('Articolo non trovato');
      }

      // Se l'articolo ha un inventario con batch e scadenza, restituiscilo
      const inv = article.inventory;
      if (inv) {
        return [{
          id: inv.id,
          batch: inv.batch || '',
          expiry: inv.expiry || '',
          currentStock: inv.currentStock || 0,
          reserved: inv.reserved || 0,
          available: Math.max(0, (inv.currentStock || 0) - (inv.reserved || 0)),
          shelfPosition: inv.shelfPosition || '',
          notes: inv.notes || ''
        }];
      }

      return [];
    } catch (error) {
      throw new Error(`Errore lettura lotti: ${error}`);
    }
  }

  /**
   * Prenota quantità per un ordine
   */
  static async reserveInventory(articleCode: string, quantity: number, orderId: string) {
    try {
      const article = await prisma.article.findFirst({
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
      const updated = await prisma.inventory.update({
        where: { id: inv.id },
        data: { reserved }
      });

      return { success: true, reserved, available, quantity };
    } catch (error) {
      throw new Error(`Errore prenotazione inventario: ${error}`);
    }
  }

  /**
   * Libera prenotazione di un ordine (quando cancellato)
   */
  static async releaseReservation(articleCode: string, quantity: number) {
    try {
      const article = await prisma.article.findFirst({
        where: { code: articleCode },
        include: { inventory: true }
      });

      if (!article || !article.inventory) {
        throw new Error('Articolo non trovato');
      }

      const inv = article.inventory;
      const reserved = Math.max(0, (inv.reserved || 0) - quantity);

      const updated = await prisma.inventory.update({
        where: { id: inv.id },
        data: { reserved }
      });

      return { success: true, reserved };
    } catch (error) {
      throw new Error(`Errore rilascio prenotazione: ${error}`);
    }
  }

  /**
   * Consuma inventario prenotato (quando ordine completato)
   */
  static async consumeReservedInventory(articleCode: string, quantity: number) {
    try {
      const article = await prisma.article.findFirst({
        where: { code: articleCode },
        include: { inventory: true }
      });

      if (!article || !article.inventory) {
        throw new Error('Articolo non trovato');
      }

      const inv = article.inventory;
      const reserved = Math.max(0, (inv.reserved || 0) - quantity);
      const currentStock = Math.max(0, (inv.currentStock || 0) - quantity);

      const updated = await prisma.inventory.update({
        where: { id: inv.id },
        data: { reserved, currentStock }
      });

      return { success: true, reserved, currentStock };
    } catch (error) {
      throw new Error(`Errore consumo inventario: ${error}`);
    }
  }
}
