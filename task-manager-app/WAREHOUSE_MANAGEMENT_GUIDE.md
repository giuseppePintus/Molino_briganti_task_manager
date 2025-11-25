# 📦 Gestione Magazzino - Documentazione Completa

## 📋 Panoramica

Il sistema di gestione magazzino è stato integrato nel Task Manager per permettere un controllo completo dell'inventario. Supporta:

- ✅ Tracciamento articoli con codici univoci
- ✅ Gestione scorte in tempo reale
- ✅ Avvisi di scorta minima con soglie configurabili
- ✅ Posizionamento articoli su scaffali
- ✅ Storico movimenti di magazzino
- ✅ Integrazione con ordini
- ✅ Esportazione dati in CSV

---

## 🗂️ Struttura del Database

### Modello `Article`
Rappresenta gli articoli del magazzino.

```
id                 INT PRIMARY KEY
code               TEXT UNIQUE        (es. F-0-SP35-5)
name               TEXT               (es. FARINA 0 SP35 da 5 kg)
description        TEXT               (facoltativo)
category           TEXT               (FARINE, SEMOLE, MANGIMI, ecc.)
unit               TEXT DEFAULT 'kg'  (kg, SFUSO, ecc.)
createdAt          DATETIME
updatedAt          DATETIME
```

**Relazioni**:
- `inventory` → Un articolo ha un inventory
- `stockAlerts` → Può avere molteplici avvisi
- `orderItems` → Collegato a ordini

---

### Modello `Inventory`
Traccia le scorte di ogni articolo.

```
id                 INT PRIMARY KEY
articleId          INT UNIQUE         (FK → Article)
currentStock       INT DEFAULT 0      (Quantità attuale)
minimumStock       INT DEFAULT 0      (Soglia per avviso)
shelfPosition      TEXT               (es. A1.1, B2.3)
lastUpdated        DATETIME
notes              TEXT               (Note aggiuntive)
```

**Relazioni**:
- `article` → Collegato a un articolo
- `movements` → Storico movimenti stock
- `alerts` → Allarmi generati

---

### Modello `StockMovement`
Traccia ogni movimento di magazzino.

```
id                 INT PRIMARY KEY
inventoryId        INT                (FK → Inventory)
type               TEXT               (IN, OUT, ADJUSTMENT)
quantity           INT                (Quantità del movimento)
reason             TEXT               (es. ORDINE, RESO, INVENTARIO)
orderId            INT                (Collegamento ordine, facoltativo)
notes              TEXT
createdAt          DATETIME
createdBy          INT                (ID utente che ha effettuato il movimento)
```

**Tipi di movimento**:
- `IN` - Entrata a magazzino
- `OUT` - Uscita per ordine/vendita
- `ADJUSTMENT` - Rettifica inventario

---

### Modello `StockAlert`
Gestisce gli avvisi di scorta.

```
id                 INT PRIMARY KEY
articleId          INT                (FK → Article)
inventoryId        INT                (FK → Inventory)
alertType          TEXT               (LOW_STOCK, CRITICAL)
currentStock       INT                (Quantità al momento dell'avviso)
minimumStock       INT                (Soglia impostata)
isResolved         BOOLEAN DEFAULT 0  (Stato risoluzione)
resolvedAt         DATETIME           (Data risoluzione)
createdAt          DATETIME
```

**Tipi di avviso**:
- `LOW_STOCK` - Stock scende sotto il minimo
- `CRITICAL` - Stock criticamente basso

---

### Modello `OrderItem`
Collegamento tra ordini e articoli.

```
id                 INT PRIMARY KEY
orderId            INT                (ID ordine esterno)
articleId          INT                (FK → Article)
quantityOrdered    INT                (Quantità richiesta)
quantityDelivered  INT DEFAULT 0      (Quantità consegnata)
unitPrice          FLOAT              (Prezzo unitario, facoltativo)
createdAt          DATETIME
```

---

## 🔌 API REST Endpoints

### Autenticazione
Tutte le route richiedono JWT token nell'header:
```
Authorization: Bearer <token>
```

---

### Importazione Dati

#### POST `/api/inventory/import/articles`
Importa articoli dal file CSV `codifica articoli.csv`.

**Risposta**:
```json
{
  "success": true,
  "imported": 156
}
```

#### POST `/api/inventory/import/shelf-positions`
Importa posizioni scaffali dal file `ELENCO POSIZIONI SCAFFALI.csv`.

**Risposta**:
```json
{
  "success": true,
  "positions": 126
}
```

---

### Lettura Articoli

#### GET `/api/inventory/articles`
Ottiene tutti gli articoli con inventario.

**Query params**:
- `search` (string, facoltativo) - Ricerca per codice, nome o categoria

**Risposta**:
```json
[
  {
    "id": 1,
    "code": "F-0-SP35-5",
    "name": "FARINA 0 SP35 da 5 kg",
    "category": "FARINE",
    "unit": "kg",
    "inventory": {
      "id": 1,
      "currentStock": 45,
      "minimumStock": 10,
      "shelfPosition": "A1.1",
      "alerts": [
        {
          "id": 10,
          "alertType": "LOW_STOCK",
          "isResolved": false
        }
      ]
    }
  }
]
```

#### GET `/api/inventory/articles/:id`
Ottiene dettagli completi di un articolo.

**Risposta**:
```json
{
  "id": 1,
  "code": "F-0-SP35-5",
  "name": "FARINA 0 SP35 da 5 kg",
  "category": "FARINE",
  "unit": "kg",
  "inventory": {
    "id": 1,
    "currentStock": 45,
    "minimumStock": 10,
    "shelfPosition": "A1.1",
    "movements": [
      {
        "id": 1,
        "type": "IN",
        "quantity": 50,
        "reason": "ORDINE",
        "createdAt": "2025-11-24T19:00:00Z"
      }
    ],
    "alerts": [
      {
        "id": 10,
        "alertType": "LOW_STOCK",
        "currentStock": 45,
        "minimumStock": 10,
        "isResolved": false,
        "createdAt": "2025-11-24T20:00:00Z"
      }
    ]
  }
}
```

---

### Gestione Stock

#### POST `/api/inventory/stock/update`
Aggiorna manualmente la quantità di un articolo.

**Body**:
```json
{
  "articleId": 1,
  "newQuantity": 50,
  "reason": "AGGIUSTAMENTO MANUALE"
}
```

**Effetti**:
- Aggiorna `currentStock` in `Inventory`
- Crea movimento in `StockMovement`
- Se stock scende sotto minimo, crea allarme in `StockAlert`

#### POST `/api/inventory/stock/reduce`
Riduce lo stock per un ordine.

**Body**:
```json
{
  "articleId": 1,
  "quantity": 5
}
```

**Effetti**:
- Riduce stock di 5 unità
- Registra movimento di tipo `OUT` con reason `ORDINE`
- Verifica soglia minima

#### POST `/api/inventory/stock/set-minimum`
Imposta la soglia minima per un articolo.

**Body**:
```json
{
  "articleId": 1,
  "minimumStock": 15
}
```

**Effetti**:
- Aggiorna `minimumStock` in `Inventory`
- Se stock attuale < nuovo minimo, crea allarme

---

### Gestione Posizioni Scaffali

#### POST `/api/inventory/shelf-position`
Aggiorna la posizione di un articolo sullo scaffale.

**Body**:
```json
{
  "articleId": 1,
  "shelfPosition": "A2.3"
}
```

---

### Gestione Allarmi

#### GET `/api/inventory/alerts`
Ottiene tutti gli allarmi non risolti.

**Risposta**:
```json
[
  {
    "id": 10,
    "article": {
      "id": 1,
      "code": "F-0-SP35-5",
      "name": "FARINA 0 SP35 da 5 kg",
      "unit": "kg"
    },
    "inventory": {
      "id": 1,
      "currentStock": 8
    },
    "alertType": "LOW_STOCK",
    "currentStock": 8,
    "minimumStock": 10,
    "isResolved": false,
    "createdAt": "2025-11-24T20:00:00Z"
  }
]
```

#### POST `/api/inventory/alerts/:alertId/resolve`
Segna un allarme come risolto.

**Risposta**:
```json
{
  "id": 10,
  "isResolved": true,
  "resolvedAt": "2025-11-24T21:00:00Z"
}
```

---

### Esportazione

#### GET `/api/inventory/export/csv`
Esporta tutto l'inventario in formato CSV.

**File di output**: `inventory_YYYY-MM-DD.csv`

**Contenuto CSV**:
```csv
Codice,Descrizione,Categoria,Quantità,Minimo,Posizione Scaffale,Stato
F-0-SP35-5,"FARINA 0 SP35 da 5 kg",FARINE,45,10,"A1.1",OK
F-0-SP35-25,"FARINA 0 SP35 da 25Kg",FARINE,8,10,"A1.2",ALLARME
...
```

---

## 🖥️ Interfaccia Web

### Accesso
```
http://localhost:5000/inventory-management.html
```

### Tab: Dashboard
Mostra statistiche globali:
- Numero totale articoli
- Unità totali in magazzino
- Avvisi attivi
- Articoli in condizioni critiche

### Tab: Inventario
- Lista completa articoli con ricerca
- Visualizzazione stock attuale vs minimo
- Stato articoli (OK / ALLARME)
- Pulsante modifica per aggiornare quantità, minimo e posizione scaffale

**Azioni**:
- Ricerca per codice, nome o categoria
- Modifica articoli (quantità, minimo, posizione)
- Esporta CSV

### Tab: Avvisi
- Elenco di tutti gli allarmi non risolti
- Dettagli: articolo, stock attuale, minimo impostato
- Pulsante "Risolvi Allarme" per chiudere

### Tab: Importa Dati
- Pulsante per importare articoli da CSV
- Pulsante per importare posizioni scaffali
- Log di importazione con numero articoli importati

---

## 🔄 Flussi di Lavoro

### Workflow 1: Importazione Iniziale
1. Vai su **Tab: Importa Dati**
2. Clicca **"Importa Articoli da CSV"**
3. Sistema importa articoli da `public/data/codifica articoli.csv`
4. Clicca **"Importa Posizioni Scaffali"** (opzionale)
5. Vai su **Tab: Inventario** per vedere gli articoli

### Workflow 2: Aggiornamento Scorte
1. Vai su **Tab: Inventario**
2. Clicca **"Modifica"** su un articolo
3. Aggiorna:
   - **Quantità Attuale**: nuovo valore
   - **Soglia Minima**: soglia di avviso
   - **Posizione Scaffale**: es. A1.1
4. Clicca **"Salva"**
5. Se stock < minimo, viene creato automaticamente un avviso

### Workflow 3: Gestione Allarmi
1. Dashboard mostra allarmi attivi
2. Vai su **Tab: Avvisi** per dettagli
3. Quando la situazione è risolta:
   - Clicca **"✓ Risolvi Allarme"**
   - Allarme marcato come risolto
4. Dashboard aggiornato

### Workflow 4: Esportazione Report
1. Vai su **Tab: Inventario**
2. Clicca **"📥 Esporta CSV"**
3. Scarica file `inventory_YYYY-MM-DD.csv`
4. Contiene: codice, nome, quantità, minimo, posizione, stato

---

## 📊 Integrazione con Ordini

### Durante la Creazione Ordine
1. Quando crei un ordine e aggiungi un articolo
2. Calcola disponibilità da `Inventory.currentStock`
3. Se quantità richiesta > disponibile, visualizza avviso
4. Viene creato `OrderItem` con quantità richiesta

### Dopo la Consegna Ordine
1. Sistema riduce automaticamente stock:
   ```
   new_stock = currentStock - quantityOrdered
   ```
2. Registra movimento `StockMovement`:
   - type: `OUT`
   - reason: `ORDINE`
   - Collegamento a `OrderItem`
3. Verifica se triggerare allarme di scorta minima

---

## 🔐 Sicurezza

- ✅ Tutti gli endpoint richiedono JWT autenticazione
- ✅ Middleware `authMiddleware` verifica il token
- ✅ Solo utenti autenticati possono modificare inventario
- ✅ Storico completo di chi ha modificato cosa

---

## 📈 Performance

- ✅ Indici su `StockAlert.isResolved` per filtri rapidi
- ✅ Indici su `StockAlert.createdAt` per ordinamento
- ✅ Relazioni con `include` ottimizzate
- ✅ Paginazione disponibile nei report

---

## 🐛 Troubleshooting

### Problema: Articoli non importati
- Verifica che file CSV esista in `public/data/codifica articoli.csv`
- Controlla formato: `codice,nome` separato da virgola
- Controlla token JWT valido

### Problema: Allarmi non triggati
- Verifica che `minimumStock` sia impostato correttamente
- Controlla che `currentStock` sia effettivamente < minimo
- Refresh pagina per aggiornamento

### Problema: Export CSV vuoto
- Verifica di avere almeno un articolo importato
- Controlla permessi database
- Controlla token di autenticazione

---

## 🚀 Prossimi Sviluppi Suggeriti

1. **Previsione scorte**: Calcola giorni residui basato su consumi
2. **Ordini automatici**: Suggerimenti di ordini quando stock < minimo
3. **Categorizzazione avanzata**: Filtraggio per categoria
4. **Report periodici**: Export mensile automatico
5. **Integrazione fornitore**: Collegamento a cataloghi esterni
6. **QR code**: Scansione codici per movimenti rapidi
7. **Statistiche**: Grafici trend consumo articoli
8. **Utenti multi-magazzino**: Gestione più depositi

---

## 📞 Support

Per problemi o domande sul sistema di gestione magazzino:
1. Controlla i log del container: `docker logs molino-briganti-task-manager`
2. Verifica API con Postman
3. Controlla browser console (F12) per errori JavaScript
4. Verifica database schema con Prisma Studio: `npx prisma studio`

---

**Versione**: 1.0.0  
**Data**: 24 Novembre 2025  
**Status**: ✅ Pronto per Produzione
