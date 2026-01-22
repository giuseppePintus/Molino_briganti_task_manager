import prisma from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

// const prisma = new PrismaClient(); // Rimossa istanza locale per usare singleton

// Percorso FISSO del file master CSV
// Priorità: 1. Env Var, 2. Path Docker, 3. Path NAS
const MASTER_CSV_PATH = process.env.MASTER_INVENTORY_CSV_PATH || 
  (fs.existsSync('/data/molino') 
    ? '/data/molino/master-Inventory.csv' 
    : '/share/Container/data/molino/master-Inventory.csv');

export class InventoryService {
  /**
   * Ritorna il percorso fisso del file CSV master
   */
  static getMasterCsvPath(): string {
    return MASTER_CSV_PATH;
  }

  /**
   * Verifica che il file master CSV esista
   */
  static isMasterCsvAvailable(): boolean {
    return fs.existsSync(MASTER_CSV_PATH);
  }

  /**
   * Sincronizza il database con il file CSV master
   * Aggiorna le quantità nel CSV mantenendo le altre colonne invariate
   */
  static async syncToMasterCSV(): Promise<{ success: boolean; updated: number; errors: number }> {
    try {
      if (!fs.existsSync(MASTER_CSV_PATH)) {
        throw new Error(`File CSV master non trovato: ${MASTER_CSV_PATH}`);
      }

      console.log(`📝 Sincronizzazione in corso verso CSV: ${MASTER_CSV_PATH}`);

      // Leggi il CSV
      let fileContent = fs.readFileSync(MASTER_CSV_PATH, 'utf-8');
      fileContent = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = fileContent.trim().split('\n');

      if (lines.length === 0) {
        throw new Error('File CSV vuoto');
      }

      // Parsa header
      const headers = this.parseCSVLine(lines[0]);
      console.log(`📋 Headers CSV: ${headers.join(', ')}`);

      // Trova indici delle colonne
      const posIndex = headers.findIndex((h: string) => h.toLowerCase() === 'pos.');
      const codeIndex = headers.findIndex((h: string) => h.toLowerCase() === 'codice');
      const lotIndex = headers.findIndex((h: string) => h.toLowerCase() === 'lotto');
      const qtIndex = headers.findIndex((h: string) => 
        h.toLowerCase() === 'qt.' || h.toLowerCase() === 'quantita' || h.toLowerCase() === 'qty'
      );
      
      if (qtIndex === -1) {
        throw new Error('Colonna quantità (Qt./Quantita/Qty) non trovata nel CSV');
      }

      // Recupera tutti gli articoli dal database
      const articles = await prisma.article.findMany({
        include: { inventory: true }
      });

      // Crea una mappa: position|code|lot -> articolo
      const articlesMap: { [key: string]: any } = {};
      articles.forEach((art: any) => {
        const pos = art.inventory?.position;
        const code = art.code;
        const lot = art.inventory?.batch || '';
        if (pos) {
          const key = `${pos}|${code}|${lot}`;
          articlesMap[key] = art;
        }
      });

      // Aggiorna le righe del CSV
      let updatedCount = 0;
      let errorCount = 0;

      const updatedLines = [lines[0]]; // Mantieni header

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) {
          updatedLines.push(line);
          continue;
        }

        const values = this.parseCSVLine(line);
        const posizione = (values[posIndex !== -1 ? posIndex : 0] || '').trim();
        const codice = (values[codeIndex !== -1 ? codeIndex : 2] || '').trim();
        const lotto = (values[lotIndex !== -1 ? lotIndex : 3] || '').trim();

        if (!posizione) {
          updatedLines.push(line);
          continue;
        }

        try {
          // Cerca l'articolo per posizione, codice e lotto
          const key = `${posizione}|${codice}|${lotto}`;
          const article = articlesMap[key];
          
          if (article && article.inventory) {
            // Aggiorna solo la quantità
            values[qtIndex] = article.inventory.currentStock.toString();
            const updatedLine = this.formatCSVLine(values);
            updatedLines.push(updatedLine);
            updatedCount++;
          } else {
            // Articolo non trovato nel DB per questa combinazione, mantieni la riga originale
            updatedLines.push(line);
          }
        } catch (err: any) {
          console.warn(`⚠️ Errore riga ${i}: ${err.message}`);
          updatedLines.push(line); // Mantieni la riga originale
          errorCount++;
        }
      }

      // Scrivi il file CSV al percorso fisso
      const updatedContent = updatedLines.join('\n');
      fs.writeFileSync(MASTER_CSV_PATH, updatedContent, 'utf-8');

      console.log(`✅ Sincronizzazione completata: ${updatedCount} righe aggiornate, ${errorCount} errori`);
      return { success: true, updated: updatedCount, errors: errorCount };
    } catch (error: any) {
      console.error('❌ Errore sincronizzazione CSV:', error);
      throw new Error(`Errore sincronizzazione: ${error.message}`);
    }
  }

  /**
   * Formatta una riga CSV gestendo correttamente le quote
   */
  private static formatCSVLine(values: string[]): string {
    return values.map(v => {
      const str = (v || '').toString();
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',');
  }

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

      // NON azzera il database - semplicemente importa/aggiorna i dati
      console.log('📥 Importazione in modalità MASTER - (Posizione, Codice, Lotto) è la chiave univoca');

      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let deletedCount = 0;

      // Mappa dei record elaborati in questo import (chiave: posizione|codice|lotto)
      const processedRecords = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) {
          continue;
        }

        const values = this.parseCSVLine(line);
        const data: any = {};
        
        headers.forEach((header, index) => {
          data[header] = values[index] || '';
        });

        // Supporta nomi colonne diversi
        const posizione = (data['Pos.'] || data['Posizione'] || data['posizione'] || '').toString().trim();
        const nome = (data['Nome'] || data['nome'] || data['Name'] || '').toString().trim();
        const codice = (data['Codice'] || data['codice'] || data['Code'] || '').toString().trim();
        const lotto = (data['Lotto'] || data['lotto'] || data['Batch'] || '').toString().trim();
        const scadenza = (data['Scadenza'] || data['scadenza'] || data['Expiry'] || '').toString().trim();
        const quantitaStr = (data['Qt.'] || data['Quantita'] || data['quantita'] || data['Qty'] || '0').toString().trim();
        const quantita = parseInt(quantitaStr) || 0;
        const annotazioni = (data['Annotazioni'] || data['annotazioni'] || data['Notes'] || '').toString().trim();

        // 🔥 CONTROLLO CRITICO: Scarta righe header duplicate o malformate
        if (posizione === 'Pos.' || posizione === 'Posizione' || 
            codice === 'Codice' || nome === 'Nome' || 
            lotto === 'Lotto' || scadenza === 'Scadenza') {
          console.log(`⏭️  Saltando riga header duplicata (posizione: ${posizione})`);
          skippedCount++;
          continue;
        }

        if (!posizione) {
          skippedCount++;
          continue;
        }

        const finalCode = codice || `EMPTY-${posizione}`;
        const recordKey = `${posizione}|${finalCode}|${lotto}`;
        processedRecords.add(recordKey);

        // Se la riga è vuota (solo posizione), saltiamo l'aggiornamento/creazione 
        // ma il record è segnato come processato
        if (!codice && !nome && quantita === 0) {
          console.log(`ℹ️ Posizione ${posizione} vuota nel CSV`);
          continue;
        }

        try {
          // Cerca l'inventario basato su POSIZIONE, CODICE e LOTTO
          let existingInventory = await prisma.inventory.findFirst({
            where: { 
              shelfPosition: posizione,
              batch: lotto || null,
              article: {
                code: finalCode
              }
            },
            include: { article: true }
          });
          
          const shelfPositionKey = `${posizione}-${finalCode}${lotto ? '-' + lotto : ''}`;

          if (existingInventory) {
            // Aggiorna l'articolo esistente
            await prisma.article.update({
              where: { id: existingInventory.articleId },
              data: {
                code: finalCode,
                name: nome || (codice ? 'Sconosciuto' : `Posizione ${posizione}`),
                category: codice ? this.getCategoryFromCode(codice) : 'Varia'
              }
            });
            
            await prisma.inventory.update({
              where: { id: existingInventory.id },
              data: {
                currentStock: quantita,
                minimumStock: 5,
                shelfPosition: shelfPositionKey,
                batch: lotto,
                expiry: scadenza,
                notes: annotazioni
              }
            });
            
            updatedCount++;
            console.log(`📝 Aggiornato articolo in posizione ${posizione}: ${finalCode} (Lotto: ${lotto}) - Qt: ${quantita}`);
          } else {
            // Crea nuovo articolo e inventario
            await prisma.article.create({
              data: {
                code: finalCode,
                name: nome || (codice ? 'Sconosciuto' : `Posizione ${posizione}`),
                category: codice ? this.getCategoryFromCode(codice) : 'Varia',
                unit: 'kg',
                inventory: {
                  create: {
                    shelfPosition: shelfPositionKey,
                    currentStock: quantita,
                    minimumStock: 5,
                    batch: lotto,
                    expiry: scadenza,
                    notes: annotazioni
                  }
                }
              }
            });
            
            importedCount++;
            console.log(`✅ Creato nuovo articolo in posizione ${posizione}: ${finalCode} (Lotto: ${lotto}) - Qt: ${quantita}`);
          }
        } catch (err: any) {
          console.error(`❌ Errore import riga ${i} (${posizione}):`, err.message);
          errorCount++;
        }
      }

      // PULIZIA: Elimina record di inventario per combinazioni non più presenti nel CSV
      const allInventories = await prisma.inventory.findMany({
        include: { article: { select: { code: true } } }
      });

      for (const inv of allInventories) {
        const key = `${inv.shelfPosition}|${inv.article.code}|${inv.batch || ''}`;
        if (inv.shelfPosition && !processedRecords.has(key)) {
          console.log(`🗑️ Eliminazione record obsoleto: Pos ${inv.shelfPosition}, Art ${inv.article.code}, Lotto ${inv.batch || 'N/D'}`);
          await prisma.inventory.delete({ where: { id: inv.id } });
          deletedCount++;
        }
      }

      console.log(`📈 Importazione completata: ${importedCount} nuovi, ${updatedCount} aggiornati, ${deletedCount} eliminati, ${errorCount} errori`);
      return { 
        success: true, 
        imported: importedCount,
        updated: updatedCount,
        deleted: deletedCount,
        errors: errorCount,
        total: importedCount + updatedCount
      };
    } catch (error) {
      console.error('🔥 Errore fatale importazione:', error);
      throw new Error(`Errore importazione inventario: ${error}`);
    }
  }

  /**
   * Importa inventario dal file CSV master sul NAS
   * Configurable via MASTER_INVENTORY_CSV_PATH env variable
   * Opzionalmente accetta un filePath custom
   */
  static async importFromMasterCSV(customFilePath?: string) {
    try {
      // Helper: normalizza i percorsi per il container
      const normalizePath = (p: string | null): string | null => {
        if (!p) return null;
        
        // Se il percorso contiene 'data/molino' o simili, cerca il file in /data/molino
        const fileName = path.basename(p);
        const possiblePaths = [
          `/data/molino/${fileName}`,
          `/share/Container/data/molino/${fileName}`,
          `/share/CACHEDEV1_DATA/Container/data/molino/${fileName}`,
          p // Percorso originale
        ];
        
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            console.log(`   ✅ File trovato a: ${testPath}`);
            return testPath;
          }
        }
        
        return fs.existsSync(p) ? p : null;
      };

      // Priorità: custom path > variabile salvata > path da .env > fallback hardcodato
      let csvPath: string | null = null;

      // 1. Se è stato specificato un path custom, usalo
      let normalizedCustomPath = normalizePath(customFilePath || null);
      if (normalizedCustomPath) {
        csvPath = normalizedCustomPath;
        console.log(`📥 Importing from custom path: ${csvPath}`);
      }
      // 2. Usa il percorso master fisso
      else {
        let normalizedMasterPath = normalizePath(MASTER_CSV_PATH);
        if (normalizedMasterPath) {
          csvPath = normalizedMasterPath;
          console.log(`📥 Importing from master CSV: ${csvPath}`);
        }
      }
      
      // 3. Altrimenti prova più percorsi possibili
      if (!csvPath) {
        const possiblePaths = [
          process.env.MASTER_INVENTORY_CSV_PATH || '',
          // Path dentro container Docker (mount: /data/molino)
          '/data/molino/tabula-20122025Inventory.csv',
          '/data/molino/20122025Inventory.csv',
          // Path fallback su NAS diretto (se run senza container)
          '/share/CACHEDEV1_DATA/Container/data/molino/tabula-20122025Inventory.csv',
          '/share/CACHEDEV1_DATA/Container/data/molino/20122025Inventory.csv',
          '/share/Container/data/molino/tabula-20122025Inventory.csv',
          '/share/Container/data/molino/20122025Inventory.csv',
          '/share/Container/tabula-20122025Inventory.csv',
          // Path locale di sviluppo
          '/app/public/data/tabula-20122025Inventory.csv',
          path.join(process.cwd(), 'public/data/tabula-20122025Inventory.csv')
        ].filter(p => p && p.trim()); // Rimuovi undefined e stringhe vuote
        
        console.log(`🔍 Ricerca file master CSV...`);
        for (const possiblePath of possiblePaths) {
          console.log(`   🔎 Controllando: ${possiblePath}`);
          if (fs.existsSync(possiblePath)) {
            csvPath = possiblePath;
            console.log(`   ✅ TROVATO: ${possiblePath}`);
            break;
          }
        }
      }

      if (!csvPath) {
        const errorMsg = `Master CSV file not found at: ${MASTER_CSV_PATH}`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      console.log(`📥 Importing from master CSV: ${csvPath}`);
      
      // Use existing import function
      const result = await this.importInventoryFromCSV(csvPath);
      console.log(`✅ Master CSV import completed:`, result);
      return result;
    } catch (error) {
      console.error('❌ Master CSV import failed:', error);
      throw new Error(`Failed to import from master CSV: ${error}`);
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

      // Sincronizza con il file master CSV dopo l'aggiornamento
      try {
        // Salva nel formato locale
        const csvPath = path.join(process.cwd(), 'public/data/inventory.csv');
        await this.saveInventoryCSVToFile(csvPath);
        console.log(`✅ CSV aggiornato dopo modifica stock articolo ${articleId}`);

        // Salva anche nel formato master nel percorso NAS fisso
        console.log(`🔄 Sincronizzazione master CSV: ${MASTER_CSV_PATH}`);
        await this.syncToMasterCSV();
        console.log(`✅ Master CSV sincronizzato`);
      } catch (csvError) {
        console.error(`❌ Errore sincronizzazione CSV: ${csvError}`);
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
      // Estrai la posizione fisica (parte prima del trattino se presente)
      const position = shelfPosition.includes('-') ? shelfPosition.split('-')[0] : shelfPosition;

      return await prisma.inventory.update({
        where: { articleId },
        data: { 
          shelfPosition: position
        },
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
   * Ottiene tutti gli articoli (deduplicated per codice)
   * Se ci sono articoli con lo stesso codice in diverse posizioni,
   * ritorna solo il primo (con quantità aggregata)
   */
  static async getAllArticles(search?: string) {
    try {
      console.log(`🔍 Ricerca articoli (search: ${search || 'nessuna'})`);
      const articles = await prisma.article.findMany({
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
      
      // Deduplica per codice - prendi il primo articolo per ogni codice
      // ma aggrega le quantità da tutte le posizioni
      const uniqueByCode = new Map<string, any>();
      
      articles.forEach((art: any) => {
        const key = art.code || art.name || 'UNKNOWN';
        
        if (!uniqueByCode.has(key)) {
          // Primo articolo con questo codice - salvalo
          uniqueByCode.set(key, {
            ...art,
            totalQuantityAllPositions: art.inventory?.currentStock || 0,
            positionsCount: 1
          });
        } else {
          // Aggiungi la quantità agli articoli già visti
          const existing = uniqueByCode.get(key);
          existing.totalQuantityAllPositions += art.inventory?.currentStock || 0;
          existing.positionsCount += 1;
        }
      });
      
      const result = Array.from(uniqueByCode.values());
      console.log(`✅ Trovati ${result.length} articoli unici (deduplicated from ${articles.length})`);
      return result;
    } catch (error) {
      console.error('❌ Errore Prisma getAllArticles:', error);
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
   * Esporta inventory in CSV formato STANDARDIZZATO (compatibile con import)
   * Formato: Posizione,Codice,Nome,Lotto,Scadenza,Quantita,Ultimo_Movimento,Data_Movimento,Stato
   */
  static async exportInventoryCSVStandardized(): Promise<string> {
    try {
      const articles = await prisma.article.findMany({
        include: { 
          inventory: { 
            include: { 
              movements: {
                orderBy: { createdAt: 'desc' },
                take: 1 // Ultimo movimento
              }
            }
          }
        }
      });

      let csv = 'Posizione,Codice,Nome,Lotto,Scadenza,Quantita,Ultimo_Movimento,Data_Movimento,Stato\n';

      for (const article of articles) {
        const inv = article.inventory;
        if (!inv) continue;

        const posizione = inv.shelfPosition || '';
        const codice = article.code || '';
        const nome = article.name || '';
        const lotto = inv.batch || '';
        const scadenza = inv.expiry || '';
        const quantita = inv.currentStock || 0;
        
        // Determina ultimo movimento e data
        const lastMovement = inv.movements && inv.movements.length > 0 ? inv.movements[0] : null;
        const ultimoMovimento = lastMovement ? `${lastMovement.type} ${lastMovement.reason || ''}`.trim() : 'NESSUNO';
        const dataMovimento = lastMovement ? lastMovement.createdAt.toISOString().split('T')[0] : '';
        
        // Stato: OK se quantità > minimo, ALLARME se sotto minimo, VUOTO se 0
        let stato = 'OK';
        if (quantita === 0) stato = 'VUOTO';
        else if (quantita < (inv.minimumStock || 5)) stato = 'ALLARME';

        csv += `"${posizione}","${codice}","${nome}","${lotto}","${scadenza}",${quantita},"${ultimoMovimento}","${dataMovimento}","${stato}"\n`;
      }

      return csv;
    } catch (error) {
      throw new Error(`Errore esportazione inventory standardizzato: ${error}`);
    }
  }

  /**
   * Salva inventory in CSV formato standardizzato su filesystem
   */
  static async saveInventoryCSVToFile(filePath: string): Promise<{ success: boolean; path: string; size: number }> {
    try {
      const csv = await this.exportInventoryCSVStandardized();
      
      // Assicurati che la directory esista
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Cartella creata: ${dir}`);
      }

      // Salva il file
      fs.writeFileSync(filePath, csv, 'utf-8');
      const fileSize = fs.statSync(filePath).size;
      
      console.log(`💾 CSV salvato: ${filePath} (${fileSize} bytes)`);
      return { success: true, path: filePath, size: fileSize };
    } catch (error) {
      console.error(`❌ Errore salvataggio CSV: ${error}`);
      throw new Error(`Errore salvataggio inventory CSV: ${error}`);
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

      // Sincronizza con il file master CSV dopo il consumo
      try {
        console.log(`🔄 Sincronizzazione master CSV dopo consumo: ${MASTER_CSV_PATH}`);
        await this.syncToMasterCSV();
        console.log(`✅ Master CSV sincronizzato`);
      } catch (csvError) {
        console.error(`❌ Errore sincronizzazione CSV dopo consumo: ${csvError}`);
      }

      return { success: true, reserved, currentStock };
    } catch (error) {
      throw new Error(`Errore consumo inventario: ${error}`);
    }
  }


  /**
   * Esporta e salva l'inventario nel formato master CSV
   * Formato: Pos.,Nome,Codice,Lotto,Scadenza,Qt.,Annotazioni
   */
  static async exportAndSaveMasterCSV(filePath: string): Promise<void> {
    try {
      const articles = await prisma.article.findMany({
        include: { inventory: true },
        orderBy: { code: 'asc' }
      });

      // Costruisci il CSV nel formato master
      let csv = 'Pos.,Nome,Codice,Lotto,Scadenza,Qt.,Annotazioni\n';
      
      for (const article of articles) {
        const inv = article.inventory;
        if (!inv) continue;

        // Estrai la posizione dallo shelfPosition (formato: "posizione-codice")
        let posizione = '';
        if (inv.shelfPosition) {
          const parts = inv.shelfPosition.split('-');
          posizione = parts[0] || '';
        }

        // Salta gli articoli placeholder (EMPTY-*)
        if (article.code && article.code.startsWith('EMPTY-')) {
          continue;
        }

        const nome = article.name || '';
        const codice = article.code || '';
        const lotto = inv.batch || '';
        const scadenza = inv.expiry || '';
        const quantita = inv.currentStock || 0;
        const annotazioni = inv.notes || '';

        // Formato CSV: quote se contiene virgole/spazi
        csv += `${posizione},"${nome}","${codice}","${lotto}","${scadenza}",${quantita},"${annotazioni}"\n`;
      }

      // Assicurati che la directory esista
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Cartella creata: ${dir}`);
      }

      // Salva il file
      fs.writeFileSync(filePath, csv, 'utf-8');
      const fileSize = fs.statSync(filePath).size;
      console.log(`💾 Master CSV salvato: ${filePath} (${fileSize} bytes)`);
    } catch (error) {
      console.error(`❌ Errore salvataggio master CSV: ${error}`);
      throw new Error(`Errore salvataggio master CSV: ${error}`);
    }
  }

  /**
   * Importa inventario dal PDF sul NAS
   * Azzerasii il master-Inventory.csv e lo ricrea dal PDF
   */
  static async importFromPdf(): Promise<{ count: number; filePath: string }> {
    try {
      const { execSync } = require('child_process');
      
      // Percorso del PDF (ora copiato in una cartella mounted del container)
      const pdfPath = '/share/Container/data/molino/Inventory.pdf';
      const outputPath = '/share/Container/data/molino/master-Inventory.csv';

      console.log(`📄 Import da PDF: ${pdfPath}`);
      console.log(`💾 Output: ${outputPath}`);

      // Esegui lo script Python SUL NAS via SSH (dove Python è disponibile)
      const pythonScript = `
import pdfplumber
import pandas as pd
import os

pdf_path = r"${pdfPath}"
output_path = r"${outputPath}"

# Apri il PDF
with pdfplumber.open(pdf_path) as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        if tables:
            for table in tables:
                all_tables.extend(table)

# Crea DataFrame
df = pd.DataFrame(all_tables)

# Estrai headers e salta prima riga se contiene headers
headers = ['Posizione', 'Nome', 'Codice', 'Lotto', 'Scadenza', 'Quantita', 'Annotazioni']
if df.iloc[0, 0] in ['Pos.', 'Posizione']:
    df = df.iloc[1:].reset_index(drop=True)

df.columns = headers[:len(df.columns)]
df = df.fillna('')
df['Quantita'] = pd.to_numeric(df['Quantita'], errors='coerce').fillna(0).astype(int)
df = df[df['Posizione'].astype(str).str.strip() != ''].reset_index(drop=True)

# Assicurati che la directory esista
os.makedirs(os.path.dirname(output_path), exist_ok=True)

# Salva il CSV
df.to_csv(output_path, index=False, encoding='utf-8')
print(f"{{len(df)}}")
`;

      // Esegui Python SUL NAS via SSH usando il percorso completo
      const fs = require('fs');
      const path = require('path');
      
      // Salva lo script Python localmente (nel container)
      const localScriptPath = `/tmp/import_inventory_${Date.now()}.py`;
      fs.writeFileSync(localScriptPath, pythonScript, 'utf-8');
      
      // Esegui Python direttamente nel container (è stato installato nel Dockerfile)
      const result = execSync(`python3 ${localScriptPath}`, {
        encoding: 'utf-8',
        timeout: 60000
      }).trim();
      
      // Pulisci file temporaneo
      try { fs.unlinkSync(localScriptPath); } catch (e) {}

      const count = parseInt(result);
      console.log(`✅ Import completato: ${count} articoli`);
      console.log(`📁 File CSV creato: ${outputPath}`);

      // Adesso importa dal CSV appena creato
      await InventoryService.importInventoryFromCSV(outputPath);

      return {
        count,
        filePath: outputPath
      };
    } catch (error: any) {
      console.error(`❌ Errore import PDF: ${error.message}`);
      throw new Error(`Errore import PDF: ${error.message}`);
    }
  }

  static async deleteArticle(articleId: number) {
    try {
      // Elimina l'inventario associato
      await prisma.inventory.deleteMany({
        where: { articleId }
      });

      // Elimina l'articolo
      await prisma.article.delete({
        where: { id: articleId }
      });

      console.log(`✅ Articolo ${articleId} eliminato`);
    } catch (error) {
      console.error(`❌ Errore delete articolo: ${error}`);
      throw error;
    }
  }
}

