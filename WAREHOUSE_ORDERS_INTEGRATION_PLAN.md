# 🔗 Integrazione Magazzino con Ordini - Next Steps

**Data**: 24 Novembre 2025  
**Status**: 📝 PIANIFICAZIONE PROSSIMA FASE

---

## 📌 Scenario: Integrazione Ordini-Magazzino

Attualmente il sistema di magazzino è **completamente operativo**, ma per massimizzare l'utilità vogliamo integrarlo con il sistema degli ordini (che already esiste in `orders-planner.html`).

---

## 🎯 Obiettivi Integrazione

1. ✅ **Visualizzare disponibilità** articoli prima di creare ordine
2. ✅ **Ridurre automaticamente stock** quando ordine viene creato
3. ✅ **Generare avvisi** se stock non sufficiente
4. **Bloccare ordini** se articolo non disponibile (opzionale)
5. **Tracciare ordine** in `StockMovement` per audit trail

---

## 🔄 Flusso Proposto

```
┌─────────────────────────────────────────────┐
│  Admin crea/salva ordine in orders-planner  │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  Estrai articoli da ordine  │
        │  (per ogni riga ordine)     │
        └─────────────────┬───────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  Riduci stock in inventario:        │
        │  newStock = currentStock - qty      │
        └─────────────────┬───────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────────────┐
        │  Crea StockMovement:                       │
        │  - type: "OUT"                             │
        │  - reason: "ORDINE"                        │
        │  - orderId: <order_id>                     │
        │  - createdBy: <user_id>                    │
        └─────────────────┬────────────────────────┘
                          │
                          ▼
        ┌──────────────────────────────────────────┐
        │  Verifica soglie minime:                 │
        │  if newStock < minimumStock:             │
        │    Crea StockAlert (LOW_STOCK)           │
        └──────────────────┬───────────────────────┘
                           │
                           ▼
        ┌─────────────────────────────────────────┐
        │  Aggiorna OrderItem con info magazzino  │
        │  (optional: quantityAvailable)          │
        └─────────────────────────────────────────┘
```

---

## 💻 Codice da Implementare

### 1. Estendi Modello `Order` in schema.prisma

Attualmente non esiste modello Order. Dovrà essere:

```prisma
model Order {
  id                Int       @id @default(autoincrement())
  orderNumber       String    @unique          // es. ORD-2025-001
  customerName      String
  orderDate         DateTime  @default(now())
  
  items             OrderItem[]                // Collega a articoli
  
  status            String    @default("DRAFT") // DRAFT, CONFIRMED, SHIPPED, COMPLETED
  totalAmount       Float?
  notes             String?
  
  createdBy         User      @relation("OrdersCreatedBy", fields: [createdById], references: [id])
  createdById       Int
  
  shipDate          DateTime?
  completedAt       DateTime?
  
  stockMovements    StockMovement[]           // Traccia movimenti magazzino
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

// Extend User model
model User {
  // ... existing fields ...
  ordersCreated     Order[] @relation("OrdersCreatedBy")
}
```

### 2. API Endpoint per Creare Ordine con Stock Reduction

```typescript
// server/src/controllers/ordersController.ts

import { InventoryService } from '../services/inventoryService';

export class OrdersController {
  static async createOrderWithInventory(req: Request, res: Response) {
    try {
      const { customerName, items, notes } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Non autorizzato' });
      }

      // Valida disponibilità articoli
      for (const item of items) {
        const article = await prisma.article.findUnique({
          where: { id: item.articleId },
          include: { inventory: true }
        });

        if (!article?.inventory) {
          return res.status(400).json({
            error: `Articolo ${article?.code} non trovato in magazzino`
          });
        }

        if (article.inventory.currentStock < item.quantity) {
          return res.status(400).json({
            error: `Stock insufficiente per ${article.name}. Disponibili: ${article.inventory.currentStock}, Richiesti: ${item.quantity}`
          });
        }
      }

      // Crea ordine
      const order = await prisma.order.create({
        data: {
          customerName,
          notes,
          createdById: userId,
          items: {
            create: items.map((item: any) => ({
              articleId: item.articleId,
              quantityOrdered: item.quantity,
              unitPrice: item.unitPrice
            }))
          }
        },
        include: { items: true }
      });

      // Riduci stock per ogni articolo
      for (const item of items) {
        await InventoryService.reduceStockForOrder(
          item.articleId,
          item.quantity,
          userId
        );
      }

      res.json({
        success: true,
        order,
        message: `Ordine creato. Stock ridotto automaticamente.`
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
```

### 3. Route Ordini

```typescript
// server/src/routes/orders.ts

import { Router } from 'express';
import { OrdersController } from '../controllers/ordersController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Crea ordine (riduce automaticamente stock)
router.post('/', OrdersController.createOrderWithInventory);

// Visualizza ordini
router.get('/', OrdersController.getAllOrders);
router.get('/:id', OrdersController.getOrderDetail);

// Aggiorna stato ordine
router.patch('/:id/status', OrdersController.updateOrderStatus);

export default router;
```

### 4. Modifica Frontend orders-planner.html

Quando salva un ordine, invia a `/api/orders` con stock reduction:

```javascript
// public/js/orders-utils.js

async function saveOrder() {
  const order = {
    customerName: document.getElementById('customerNameInput').value,
    items: getOrderItems(),
    notes: document.getElementById('orderNotesInput').value
  };

  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(order)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore creazione ordine');
    }

    const result = await response.json();
    showMessage(`✓ Ordine creato! Stock ridotto automaticamente.`, 'success');
    
    // Aggiorna magazzino
    if (window.loadInventoryDashboard) {
      loadInventoryDashboard();
    }

  } catch (error) {
    showMessage(`✗ Errore: ${error.message}`, 'danger');
  }
}

function getOrderItems() {
  // Estrai righe tabella ordine
  const rows = document.querySelectorAll('#orderItemsTable tbody tr');
  return Array.from(rows).map(row => ({
    articleId: row.dataset.articleId,
    quantity: parseInt(row.querySelector('[data-qty]').value),
    unitPrice: parseFloat(row.querySelector('[data-price]').value)
  }));
}
```

---

## 🛠️ Setup Steps

### Fase 1: Database (1 ora)
1. [ ] Aggiungi modello `Order` a `schema.prisma`
2. [ ] Aggiungi relazione `OrderItem.orderId` → `Order.id`
3. [ ] Esegui `prisma migrate dev --name add_orders_system`
4. [ ] Aggiorna `databaseInit.ts` con creazione tabelle

### Fase 2: Backend (2 ore)
1. [ ] Crea `server/src/controllers/ordersController.ts`
2. [ ] Implementa metodo `createOrderWithInventory()`
3. [ ] Modifica `InventoryService.reduceStockForOrder()` se necessario
4. [ ] Crea `server/src/routes/orders.ts`
5. [ ] Registra routes in `server/src/index.ts`
6. [ ] Test con curl/Postman

### Fase 3: Frontend (1 ora)
1. [ ] Estendi `public/js/orders-utils.js`
2. [ ] Modifica `saveOrder()` per chiamare `/api/orders`
3. [ ] Aggiungi gestione errori e messaggi
4. [ ] Test in browser

### Fase 4: Integration (1 ora)
1. [ ] Rebuild Docker: `docker-compose up -d --build`
2. [ ] Test end-to-end:
   - Crea ordine con articoli
   - Verifica stock ridotto
   - Controlla allarmi se necessario
   - Visualizza storico in magazzino
3. [ ] Update documentation

### Fase 5: Deployment (30 min)
1. [ ] Push image multi-arch a Docker Hub
2. [ ] Deploy su NAS
3. [ ] Test su ARM64 Synology

---

## 🧪 Test Scenarios

### Test 1: Ordine Normale
```
1. Stock articolo A: 100
2. Crea ordine: 30 unità articolo A
3. Aspettati: Stock = 70, Movimento OUT registrato
4. ✓ Allarme NO (> minimo)
```

### Test 2: Ordine Scatena Allarme
```
1. Stock articolo B: 15, Minimo: 10
2. Crea ordine: 8 unità articolo B
3. Aspettati: Stock = 7 (< minimo 10)
4. ✓ Allarme LOW_STOCK creato
5. ✓ Dashboard mostra avviso
```

### Test 3: Stock Insufficiente
```
1. Stock articolo C: 20
2. Tenta ordine: 30 unità articolo C
3. Aspettati: Errore "Stock insufficiente"
4. ✓ Ordine NON creato
5. ✓ Stock NON ridotto
```

### Test 4: Ordine Multiplo Articolo
```
1. Crea ordine con 5 articoli diversi
2. Aspettati: 5 movimenti OUT creati
3. ✓ Verifica storico in inventory
4. ✓ Tutti gli allarmi (se < minimo)
```

---

## 📋 Checklist Implementazione

- [ ] Schema database aggiornato
- [ ] Migration Prisma creata
- [ ] OrdersController implementato
- [ ] OrdersService se necessario
- [ ] Routes ordini registrate
- [ ] Frontend orders-planner aggiornato
- [ ] Test API con Postman
- [ ] Test UI in browser
- [ ] Docker rebuilt e testato
- [ ] Documentazione aggiornata
- [ ] Deploy su Docker Hub
- [ ] Test su NAS

---

## 🔗 Dipendenze

- ✅ Sistema magazzino (già completato)
- ✅ Autenticazione JWT (già implementata)
- ✅ Database SQLite (già operativo)
- ✅ Docker setup (già pronto)

---

## ⏱️ Tempo Stimato

| Attività | Tempo |
|----------|-------|
| Database setup | 1 ora |
| Backend development | 2 ore |
| Frontend integration | 1 ora |
| Testing | 1 ora |
| Deployment | 30 min |
| **TOTALE** | **~5.5 ore** |

---

## 💾 File da Creare/Modificare

### Nuovi File
- `server/src/controllers/ordersController.ts`
- `server/src/services/ordersService.ts`
- `server/src/routes/orders.ts`

### Da Modificare
- `server/prisma/schema.prisma`
- `server/src/index.ts`
- `server/src/services/databaseInit.ts`
- `public/js/orders-utils.js`
- `public/orders-planner.html`

---

## 🎓 Appunti Importanti

1. **Stock Lock**: Durante creazione ordine, sempre validare stock PRIMA di ridurlo
2. **Transazioni**: Idealmente usare transazione Prisma per atomicità
3. **Audit Trail**: Ogni movimento registrato con user ID
4. **Concorrenza**: Se 2 ordini simultanei, verify stock sufficiente
5. **Rollback**: Se riduzione stock fallisce, ordine non va creato

---

## 📞 Domande da Risolvere

❓ Gli ordini attualmente sono salvati dove? In localStorage o database?  
❓ Quale struttura dati attualmente per OrderItem?  
❓ È necessario tracciare "quantityDelivered" diverso da "quantityOrdered"?  
❓ Bloccare ordini se stock insufficiente o solo warning?  

---

**Prossimo Passo**: Confermare requisiti, poi procedere con implementazione.

**Responsabilità**: Pronto quando l'utente lo richiede!

---

**Versione**: 1.0 (Planning)  
**Status**: 📝 Ready for Next Phase  
**Last Updated**: 24 Novembre 2025
