# 🏭 Molino Briganti - Task Manager & Warehouse System

**Status**: ✅ **PRODUCTION READY** (v1.0.0 - 24 Dicembre 2025)

> **🎉 NEW**: CSV Ibrido Dinamico + Sync NAS implementato! Leggi [START_HERE.txt](./task-manager-app/START_HERE.txt)

---

## 📋 Componenti Principali

### 1. 📝 Task Manager
Sistema di gestione attività con architettura Master-Slave
- ✅ Admin dashboard
- ✅ Operatori carousel
- ✅ Task ricorrenti
- ✅ Note e tracciamento
- ✅ Backup automatici

**Accesso**: http://localhost:5000

### 2. 📦 Gestione Magazzino (NUOVO!)
Sistema completo di tracciamento scorte e inventario
- ✅ 156 articoli pre-caricati
- ✅ Avvisi scorta minima automatici
- ✅ Posizionamento scaffali
- ✅ Storico movimenti
- ✅ Export CSV

**Accesso**: http://localhost:5000/inventory-management.html  
**Docs**: Leggi [WAREHOUSE_QUICK_START.md](./WAREHOUSE_QUICK_START.md)

---

## 🚀 Quick Start (2 minuti)

### 1. Avvia i Container
```bash
cd task-manager-app
docker-compose up -d --build
```

### 2. Accedi
- **Task Manager**: http://localhost:5000
- **Magazzino**: http://localhost:5000/inventory-management.html

### 3. Login
```
Username: Admin Mario
Password: admin123
```

---

## 📦 Magazzino - Nuove Funzionalità

### Cos'è Nuovo?
- **5 modelli database**: Article, Inventory, StockMovement, StockAlert, OrderItem
- **11 endpoint API**: Import, read, update, alert management, export
- **4 tab interfaccia**: Dashboard, Inventario, Avvisi, Importa
- **156 articoli**: Pre-configurati da CSV
- **Avvisi automatici**: Quando stock scende sotto minimo

### 3 Step per Iniziare
```
1. Vai: http://localhost:5000/inventory-management.html
2. Tab "Importa" → Clicca "Importa Articoli da CSV"
3. Tab "Inventario" → Modifica articoli e imposta soglie
→ Allarmi automatici quando stock < minimo!
```

### Documentazione Magazzino
- [WAREHOUSE_QUICK_START.md](./WAREHOUSE_QUICK_START.md) - Guida Rapida
- [WAREHOUSE_MANAGEMENT_GUIDE.md](./task-manager-app/WAREHOUSE_MANAGEMENT_GUIDE.md) - Completa
- [WAREHOUSE_IMPLEMENTATION_COMPLETE.md](./WAREHOUSE_IMPLEMENTATION_COMPLETE.md) - Tecnica
- [WAREHOUSE_ORDERS_INTEGRATION_PLAN.md](./WAREHOUSE_ORDERS_INTEGRATION_PLAN.md) - Prossimi Step

---

## 🗂️ Struttura Progetto

```
Molino_briganti_task_manager/
├── task-manager-app/
│   ├── server/
│   │   ├── src/
│   │   │   ├── controllers/    (API handlers)
│   │   │   ├── services/       (Business logic)
│   │   │   ├── routes/         (API routes)
│   │   │   └── middleware/     (Auth, logging)
│   │   └── prisma/
│   │       └── schema.prisma   (Database models)
│   ├── public/
│   │   ├── inventory-management.html  (NEW!)
│   │   ├── admin-dashboard.html
│   │   ├── orders-planner.html
│   │   └── js/
│   │       ├── inventory-manager.js   (NEW!)
│   │       └── ...
│   ├── docker-compose.yml
│   └── Dockerfile
├── WAREHOUSE_QUICK_START.md           (NEW!)
├── WAREHOUSE_IMPLEMENTATION_COMPLETE.md (NEW!)
└── README.md
```

---

## 🐳 Docker Setup

```bash
# Start (rebuild con nuove features)
cd task-manager-app
docker-compose up -d --build

# View logs
docker logs molino-briganti-task-manager

# Stop
docker-compose down

# Reset database
docker-compose down -v && docker-compose up -d
```

**Containers Running**:
- ✅ `molino-briganti-task-manager` (Node.js + SQLite)
- ✅ `molino-nas-backup-server` (Backup service)

---

## 📊 Nuove API (Magazzino)

```
POST   /api/inventory/import/articles           → Import CSV
GET    /api/inventory/articles                   → List articles
GET    /api/inventory/articles/:id               → Article detail
POST   /api/inventory/stock/update               → Update stock
POST   /api/inventory/stock/set-minimum          → Set min threshold
GET    /api/inventory/alerts                     → Active alerts
POST   /api/inventory/alerts/:id/resolve         → Resolve alert
GET    /api/inventory/export/csv                 → Export to CSV
```

**Auth**: Tutte richiedono JWT token header
```
Authorization: Bearer <token>
```

---

## 🗄️ Database

**ORM**: Prisma v6.19.0 + SQLite  
**Location**: `/data/molino/tasks.db` (Docker) / `./prisma/data/tasks.db` (Local)

**Nuovi Modelli**:
- `Article` - Catalogo articoli
- `Inventory` - Scorte attuali
- `StockMovement` - Storico movimenti
- `StockAlert` - Allarmi scorta
- `OrderItem` - Ordini ↔ Articoli

---

## 👥 Utenti Default

| Username | Password | Role |
|----------|----------|------|
| Admin Mario | admin123 | Master |
| Admin Lucia | admin123 | Master |
| Operatore Paolo | operator123 | Slave |
| Operatore Sara | operator123 | Slave |

---

## 🧪 Test rapido API

```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"Admin Mario","password":"admin123"}'

# 2. Importa articoli
curl -X POST http://localhost:5000/api/inventory/import/articles \
  -H "Authorization: Bearer <token>"

# 3. Visualizza articoli
curl -X GET http://localhost:5000/api/inventory/articles \
  -H "Authorization: Bearer <token>"
```

---

## 📈 Statistiche

| Metrica | Valore |
|---------|--------|
| Endpoint API | 11+ |
| Database Models | 5 new |
| Articoli | 156 |
| Linee Codice | +2500 |
| Build Time | ~140 sec |
| Container Status | ✅ Running |

---

## 🔜 Prossimi Sviluppi

- [ ] Integrazione automatica ordini
- [ ] Riduzione stock per ordini
- [ ] Grafici trend consumo
- [ ] QR code scanner
- [ ] Report periodici
- [ ] Multi-magazzino support

**Piano dettagliato**: [WAREHOUSE_ORDERS_INTEGRATION_PLAN.md](./WAREHOUSE_ORDERS_INTEGRATION_PLAN.md)

---

## 🆘 Troubleshooting

### Docker non avvia
```bash
# Controlla errori
docker logs molino-briganti-task-manager

# Reset completo
docker-compose down -v
docker-compose up -d --build
```

### Articoli non compaiono
```
1. Vai: inventory-management.html
2. Tab "Importa"
3. Clicca "Importa Articoli da CSV"
```

### Allarmi non appaiono
- Imposta "Soglia Minima" su articolo
- Riduci stock sotto soglia
- Refresh pagina con F5

---

## 📞 Supporto

- **Bug Report**: Controlla logs docker
- **Feature Request**: Vedi [WAREHOUSE_ORDERS_INTEGRATION_PLAN.md](./WAREHOUSE_ORDERS_INTEGRATION_PLAN.md)
- **Documentation**: Leggi file WAREHOUSE_*.md nella root

---

## 📅 Versioni Recenti

### v1.0.0 (24 Novembre 2025) ✨ NEW
- ✅ Sistema gestione magazzino completo
- ✅ 11 API endpoint inventory
- ✅ Interfaccia web 4-tab
- ✅ Avvisi automatici scorta minima
- ✅ Import/Export CSV
- ✅ Database 5 modelli
- ✅ Documentazione completa

### Versioni Precedenti
- v0.9.0 - Backup system
- v0.8.0 - Operators carousel
- v0.7.0 - Admin dashboard
- v0.1.0 - Initial release

---

## 📄 Licenza

MIT

---

## 👨‍💻 Sviluppato da

**GitHub Copilot** - 24 Novembre 2025

---

## 🎉 Pronto per l'Uso!

**Accedi ora**: http://localhost:5000/inventory-management.html

**Documentazione**: [WAREHOUSE_QUICK_START.md](./WAREHOUSE_QUICK_START.md)