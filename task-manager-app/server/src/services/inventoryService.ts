import prisma from '../lib/prisma';

export class InventoryService {
  /**
   * Aggiorna stock per un articolo
   */
  static async updateStock(articleId: number, newQuantity: number, reason: string, userId: number, batch?: string, expiry?: string) {
    try {
      let inventory: any = await prisma.inventory.findUnique({
        where: { articleId },
        include: { article: true }
      });

      if (!inventory) {
        // Crea inventory se mancante (articolo mai caricato a magazzino)
        inventory = await prisma.inventory.create({
          data: { articleId, currentStock: 0, minimumStock: 0 },
          include: { article: true }
        });
      }

      const oldQuantity = inventory.currentStock;
      const difference = newQuantity - oldQuantity;

      // Aggiorna stock
      const updated = await prisma.inventory.update({
        where: { articleId },
        data: {
          currentStock: newQuantity,
          ...(batch !== undefined && { batch: batch || null }),
          ...(expiry !== undefined && { expiry: expiry || null }),
        },
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
  static async setMinimumStock(articleId: number, minimumStock: number, criticalStock?: number) {
    try {
      const data: any = { minimumStock };
      if (criticalStock !== undefined && criticalStock !== null && !Number.isNaN(criticalStock)) {
        data.criticalStock = criticalStock;
      }
      const inventory = await prisma.inventory.upsert({
        where: { articleId },
        update: data,
        create: {
          articleId,
          currentStock: 0,
          minimumStock,
          criticalStock: data.criticalStock ?? 0,
        },
        include: { article: true }
      });

      // Crea allarme se sotto soglia
      const crit = (inventory as any).criticalStock ?? 0;
      if (crit > 0 && inventory.currentStock <= crit) {
        await this.createStockAlert(articleId, inventory.id, 'CRITICAL', inventory.currentStock, crit);
      } else if (minimumStock > 0 && inventory.currentStock <= minimumStock) {
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
          },
          shelfEntries: true
        },
        orderBy: { code: 'asc' }
      });
      
      // Deduplica per codice - prendi il primo articolo per ogni codice
      // ma aggrega le quantità da tutte le posizioni
      const uniqueByCode = new Map<string, any>();
      
      articles.forEach((art: any) => {
        const key = art.code || art.name || 'UNKNOWN';
        
        if (!uniqueByCode.has(key)) {
          uniqueByCode.set(key, {
            ...art,
            totalQuantityAllPositions: art.inventory?.currentStock || 0,
            positionsCount: 1
          });
        } else {
          const existing = uniqueByCode.get(key);
          // Preferisci il record che ha effettivamente un'inventory nel DB
          if (!existing.inventory && art.inventory) {
            const prevTotal = existing.totalQuantityAllPositions;
            uniqueByCode.set(key, {
              ...art,
              totalQuantityAllPositions: prevTotal + (art.inventory?.currentStock || 0),
              positionsCount: existing.positionsCount + 1
            });
          } else {
            existing.totalQuantityAllPositions += art.inventory?.currentStock || 0;
            existing.positionsCount += 1;
          }
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
   * Prenota quantità per un ordine
   */
  static async reserveInventory(articleCode: string, quantity: number, orderId: string) {
    try {
      const article = await prisma.article.findFirst({
        where: { code: articleCode },
        include: { inventory: true }
      });

      if (!article) {
        // Articolo non trovato nel DB - skip prenotazione ma non bloccare l'ordine
        console.log(`⚠️ [reserveInventory] Articolo ${articleCode} non trovato - skip prenotazione`);
        return { success: true, skipped: true, reason: 'Articolo non trovato nel database' };
      }

      if (!article.inventory) {
        // Articolo trovato ma senza record inventario - skip prenotazione
        console.log(`⚠️ [reserveInventory] Articolo ${articleCode} senza inventario - skip prenotazione`);
        return { success: true, skipped: true, reason: 'Nessun inventario associato' };
      }

      const inv = article.inventory;
      // reserved è in KG, currentStock è in COLLI
      const weightPerUnit = article.weightPerUnit || 1;
      const colliToReserve = Math.ceil(quantity / weightPerUnit);
      const alreadyReservedColli = Math.ceil((inv.reserved || 0) / weightPerUnit);
      const available = (inv.currentStock || 0) - alreadyReservedColli - colliToReserve;

      if (available < 0) {
        // Stock insufficiente - logga warning ma non bloccare
        console.log(`⚠️ [reserveInventory] Stock insufficiente per ${articleCode}: disponibili ${inv.currentStock || 0} colli - da prenotare ${colliToReserve} colli`);
        return { success: true, skipped: true, reason: `Stock insufficiente: disponibili ${inv.currentStock || 0} colli (${(inv.currentStock || 0) * weightPerUnit}kg)` };
      }

      // Aggiorna il campo reserved (manteniamo in KG per compatibilità)
      const newReservedKg = (inv.reserved || 0) + quantity;
      await prisma.inventory.update({
        where: { id: inv.id },
        data: { reserved: newReservedKg }
      });

      return { success: true, reserved: newReservedKg, available, quantity };
    } catch (error) {
      // Non bloccare l'ordine per errori di inventario
      console.error(`❌ [reserveInventory] Errore: ${error}`);
      return { success: true, skipped: true, reason: `Errore: ${error}` };
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
   * Azzera TUTTE le prenotazioni (usare quando gli ordini sono stati eliminati senza rilascio)
   */
  static async resetAllReservations() {
    const result = await prisma.inventory.updateMany({
      where: { reserved: { gt: 0 } },
      data: { reserved: 0 }
    });
    console.log(`✅ [resetAllReservations] Azzerate ${result.count} prenotazioni`);
    return { success: true, count: result.count };
  }

  /**
   * Consuma inventario prenotato (quando ordine completato)
   * quantity è in KG; currentStock e ShelfEntries sono in COLLI
   */
  static async consumeReservedInventory(articleCode: string, quantityKg: number) {
    try {
      const article = await prisma.article.findFirst({
        where: { code: articleCode },
        include: {
          inventory: true,
          shelfEntries: { orderBy: { id: 'asc' } }
        }
      });

      if (!article || !article.inventory) {
        throw new Error('Articolo non trovato');
      }

      const weightPerUnit = article.weightPerUnit || 1;
      // Converti kg → colli (arrotonda per eccesso per non lasciare frazioni)
      const colliToConsume = Math.ceil(quantityKg / weightPerUnit);

      const inv = article.inventory;
      // reserved è in KG (salvato direttamente dall'ordine)
      const reservedKg = Math.max(0, (inv.reserved || 0) - quantityKg);
      // currentStock è in COLLI
      const newCurrentStock = Math.max(0, (inv.currentStock || 0) - colliToConsume);

      await prisma.inventory.update({
        where: { id: inv.id },
        data: { reserved: reservedKg, currentStock: newCurrentStock }
      });

      // Riduci le ShelfEntry in ordine (svuota la prima, poi la seconda, ecc.)
      let remaining = colliToConsume;
      for (const entry of article.shelfEntries) {
        if (remaining <= 0) break;
        const toSubtract = Math.min(entry.quantity, remaining);
        const newQty = entry.quantity - toSubtract;
        await prisma.shelfEntry.update({
          where: { id: entry.id },
          data: { quantity: newQty }
        });
        remaining -= toSubtract;
        console.log(`📦 [consume] ShelfEntry ${entry.id} (${entry.positionCode}): ${entry.quantity} → ${newQty} colli`);
      }

      console.log(`✅ [consume] ${articleCode}: -${quantityKg}kg = -${colliToConsume} colli. currentStock: ${inv.currentStock} → ${newCurrentStock}`);
      return { success: true, reserved: reservedKg, currentStock: newCurrentStock, colliConsumed: colliToConsume };
    } catch (error) {
      throw new Error(`Errore consumo inventario: ${error}`);
    }
  }

  static async createArticle(data: { code: string; name: string; description?: string; category?: string; unit?: string; weightPerUnit?: number; barcode?: string }) {
    try {
      const article = await prisma.article.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description || null,
          category: data.category || null,
          unit: data.unit || 'kg',
          weightPerUnit: data.weightPerUnit || 1,
          barcode: data.barcode || null,
        },
        include: { inventory: true }
      });
      console.log(`✅ Articolo creato: ${article.id} - ${article.code}`);
      return article;
    } catch (error) {
      console.error(`❌ Errore create articolo: ${error}`);
      throw error;
    }
  }

  static async updateArticle(articleId: number, data: { code?: string; name?: string; description?: string; category?: string; unit?: string; weightPerUnit?: number; barcode?: string }) {
    try {
      const article = await prisma.article.update({
        where: { id: articleId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.category !== undefined && { category: data.category || null }),
          ...(data.unit !== undefined && { unit: data.unit }),
          ...(data.weightPerUnit !== undefined && { weightPerUnit: data.weightPerUnit }),
          ...(data.barcode !== undefined && { barcode: data.barcode || null }),
        },
        include: { inventory: true }
      });
      console.log(`✅ Articolo aggiornato: ${article.id} - ${article.code}`);
      return article;
    } catch (error) {
      console.error(`❌ Errore update articolo: ${error}`);
      throw error;
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

  // =============================================
  // SHELF POSITIONS
  // =============================================

  static async getShelfPositions(): Promise<any[]> {
    try {
      return await prisma.shelfPosition.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' }
      });
    } catch (error) {
      console.error('❌ Errore getShelfPositions:', error);
      throw error;
    }
  }

  static async createShelfPosition(code: string, description?: string) {
    try {
      const position = await prisma.shelfPosition.create({
        data: { code, description: description || null }
      });
      console.log(`✅ Posizione scaffale creata: ${code}`);
      return position;
    } catch (error) {
      console.error(`❌ Errore create posizione: ${error}`);
      throw error;
    }
  }

  static async updateShelfPositionEntry(id: number, data: { code?: string; description?: string; isActive?: boolean }) {
    try {
      const position = await prisma.shelfPosition.update({
        where: { id },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        }
      });
      console.log(`✅ Posizione scaffale aggiornata: ${position.code}`);
      return position;
    } catch (error) {
      console.error(`❌ Errore update posizione: ${error}`);
      throw error;
    }
  }

  static async deleteShelfPosition(id: number) {
    try {
      await prisma.shelfPosition.delete({ where: { id } });
      console.log(`✅ Posizione scaffale ${id} eliminata`);
    } catch (error) {
      console.error(`❌ Errore delete posizione: ${error}`);
      throw error;
    }
  }

  static async seedShelfPositions(positions: string[]) {
    try {
      let created = 0;
      for (const code of positions) {
        const existing = await prisma.shelfPosition.findUnique({ where: { code } });
        if (!existing) {
          await prisma.shelfPosition.create({ data: { code } });
          created++;
        }
      }
      console.log(`✅ Seed posizioni: ${created} nuove su ${positions.length} totali`);
      return { created, total: positions.length };
    } catch (error) {
      console.error(`❌ Errore seed posizioni: ${error}`);
      throw error;
    }
  }

  // =============================================
  // SHELF ENTRIES (many-to-many: article × position)
  // =============================================

  static async getShelfEntries(filters: { articleId?: number; positionCode?: string } = {}) {
    return await prisma.shelfEntry.findMany({
      where: {
        ...(filters.articleId && { articleId: filters.articleId }),
        ...(filters.positionCode && { positionCode: filters.positionCode }),
      },
      include: { article: true },
      orderBy: [{ positionCode: 'asc' }, { articleId: 'asc' }]
    });
  }

  static async upsertShelfEntry(data: { articleId: number; positionCode: string; quantity: number; batch?: string; expiry?: string; notes?: string }) {
    // Cerca entry esistente con stesso articolo, posizione e lotto
    const existing = await prisma.shelfEntry.findFirst({
      where: {
        articleId: data.articleId,
        positionCode: data.positionCode,
        batch: data.batch ?? null
      }
    });
    if (existing) {
      return await prisma.shelfEntry.update({
        where: { id: existing.id },
        data: { quantity: data.quantity, expiry: data.expiry ?? null, notes: data.notes ?? null },
        include: { article: true }
      });
    }
    return await prisma.shelfEntry.create({
      data,
      include: { article: true }
    });
  }

  static async updateShelfEntry(id: number, data: { quantity?: number; batch?: string | null; expiry?: string | null; notes?: string | null; positionCode?: string }) {
    // Se si sta spostando in un'altra posizione, cerca merge possibile
    if (data.positionCode) {
      const current = await prisma.shelfEntry.findUnique({ where: { id } });
      if (current && data.positionCode !== current.positionCode) {
        const movingBatch = data.batch !== undefined ? data.batch : current.batch;
        const movingExpiry = data.expiry !== undefined ? data.expiry : current.expiry;
        const movingQty = data.quantity ?? current.quantity;

        // Cerca entry con stesso articolo, stessa posizione destinazione, stesso lotto e scadenza
        const existing = await prisma.shelfEntry.findFirst({
          where: {
            articleId: current.articleId,
            positionCode: data.positionCode,
            batch: movingBatch || null,
            expiry: movingExpiry || null
          }
        });

        if (existing) {
          // Stesso lotto e scadenza → unisci sommando le quantità
          const merged = await prisma.shelfEntry.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + movingQty },
            include: { article: true }
          });
          await prisma.shelfEntry.delete({ where: { id } });
          console.log(`✅ Entry ${id} merged into ${existing.id} (qty: ${merged.quantity}) at ${data.positionCode}`);
          return merged;
        }
        // Lotto/scadenza diversi → sposta normalmente (crea nuova entry nella destinazione)
      }
    }

    return await prisma.shelfEntry.update({
      where: { id },
      data,
      include: { article: true }
    });
  }

  static async deleteShelfEntry(id: number) {
    await prisma.shelfEntry.delete({ where: { id } });
  }
}
