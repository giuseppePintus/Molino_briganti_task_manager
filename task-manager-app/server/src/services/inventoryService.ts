import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

export class InventoryService {
  /**
   * Parsing CSV - gestisce correttamente quote e virgole
   */
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
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
        } else {
          // Toggle quote mode
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // Comma outside quotes = delimiter
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

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
      
      const headers = this.parseCSVLine(lines[0]);
      console.log('📋 Headers:', headers);
      console.log('📈 Numero di colonne:', headers.length);

      // AZZERA IL DATABASE PRIMA DI IMPORTARE
      console.log('🧹 Pulizia inventario precedente...');
      await prisma.inventory.deleteMany({});
      await prisma.article.deleteMany({});
      console.log('✅ Inventario azzerato');

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
        const data: any = {};
        
        headers.forEach((header, index) => {
          data[header] = values[index] || '';
        });

        console.log(`📍 Riga ${i}: Posizione=${data['Posizione']}, Codice=${data['Codice']}, Quantita=${data['Quantita']}`);

        // Estrai i dati
        const posizione = data['Posizione'] ? String(data['Posizione']).trim() : '';
        const nome = data['Nome'] ? String(data['Nome']).trim() : '';
        const codice = data['Codice'] ? String(data['Codice']).trim() : '';
        const lotto = data['Lotto'] ? String(data['Lotto']).trim() : '';
        const scadenza = data['Scadenza'] ? String(data['Scadenza']).trim() : '';
        const quantita = parseInt(String(data['Quantita']).trim()) || 0;
        const annotazioni = data['Annotazioni'] ? String(data['Annotazioni']).trim() : '';

        // Salta righe completamente vuote
        if (!posizione || posizione === '') {
          skippedCount++;
          console.log(`⏭️ Riga ${i} saltata: posizione vuota`);
          continue;
        }

        try {
          // Crea sempre nuovo articolo (il database è stato azzerato all'inizio)
          // Usa un codice univoco: se codice è vuoto, usa EMPTY-{posizione}
          // Altrimenti usa il codice fornito (che potrebbe apparire più volte in posizioni diverse)
          const finalCode = codice || `EMPTY-${posizione}`;
          
          // IMPORTANTE: Se una posizione ha più articoli, codifichiamo la posizione in modo univoco
          // aggiungendo il codice articolo. Questo permette di avere più articoli nella stessa
          // posizione shelf, rappresentati come posizioni diverse nel database (posizione+codice)
          const shelfPositionKey = `${posizione}-${finalCode}`;
          
          // Crea un nome univoco per il database aggiungendo posizione se necessario
          // In modo da garantire che articoli con lo stesso codice in posizioni diverse siano distinti
          const uniqueKey = `${finalCode}@${posizione}`;
          
          const createData = {
            code: finalCode, // Codice dell'articolo (può ripetersi in posizioni diverse)
            name: nome || (codice ? 'Sconosciuto' : `Posizione ${posizione}`),
            category: codice ? this.getCategoryFromCode(codice) : 'Varia',
            unit: 'kg',
            inventory: {
              create: {
                currentStock: quantita,
                minimumStock: 5,
                reserved: 0,
                shelfPosition: shelfPositionKey, // Posizione codificata: posizione-codicearticolo
                batch: lotto,
                expiry: scadenza,
                notes: annotazioni
              }
            }
          };
          console.log(`📦 Data creazione articolo ${i} (${uniqueKey}):`, JSON.stringify(createData));
          const article = await prisma.article.create({
            data: createData,
            include: { inventory: true }
          });
          importedCount++;
          console.log(`✅ Importato articolo ${i}: ${codice || 'VUOTO'} (${nome}) @${posizione} - Quantita: ${quantita}`);
        } catch (err: any) {
          console.error(`❌ Errore import riga ${i} (${codice}):`, err.message || err);
          console.error(`   Stack:`, err.stack);
          if (err.code) console.error(`   Code:`, err.code);
          if (err.meta) console.error(`   Meta:`, JSON.stringify(err.meta));
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

      const batches: any[] = [];
      const descrizioniByCode: { [key: string]: string } = {}; // Cache delle descrizioni

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

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
    } catch (error) {
      throw new Error(`Errore lettura lotti: ${error}`);
    }
  }

  /**
   * Utility per parsare date formato DD/MM/YYYY
   */
  private static parseDate(dateStr: string): Date {
    if (!dateStr || dateStr === '0') return new Date(9999, 11, 31); // Data molto futura per batch vecchi
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(9999, 11, 31);
    const [day, month, year] = parts.map(p => parseInt(p));
    return new Date(year, month - 1, day);
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

  /**
   * Elimina tutto l'inventario (cancella tutti gli articoli e i dati associati)
   */
  static async resetAllInventory() {
    try {
      // Prima elimina tutti gli inventory items (che a cascata elimina gli alerts)
      const inventoryResult = await prisma.inventory.deleteMany({});
      
      // Poi elimina tutti gli articoli
      const articlesResult = await prisma.article.deleteMany({});

      console.log(`✅ Inventario eliminato: ${articlesResult.count} articoli cancellati`);

      return {
        success: true,
        updated: articlesResult.count,
        message: `Inventario pulito: ${articlesResult.count} articoli eliminati`
      };
    } catch (error) {
      throw new Error(`Errore eliminazione inventario: ${error}`);
    }
  }
}
