# 🏭 Molino Briganti - Task Manager & Warehouse System

## Descrizione Progetto

**Molino Briganti Task Manager** è un'applicazione web completa per la gestione integrata di ordini, magazzino e operatori, sviluppata con tecnologie moderne e containerizzata per ambienti di produzione.

### 🎯 Obiettivo

Centralizzare la gestione di:
- **Ordini** (consegne e ritiri)
- **Magazzino** (inventario, stock, tracciamento)
- **Operatori** (assegnazione compiti, tracking)
- **Backup automatico** su NAS per disaster recovery

### 💻 Stack Tecnologico

- **Backend**: Node.js 18 + Express + TypeScript
- **Database**: SQLite (file-based, no external dependencies)
- **ORM**: Prisma
- **Frontend**: HTML5 + CSS3 + JavaScript vanilla
- **Autenticazione**: JWT tokens
- **Containerizzazione**: Docker + docker-compose
- **Deployment**: Docker Desktop (locale) + NAS (192.168.1.248)

### ✨ Caratteristiche Principali

✅ **Dashboard Admin** - Gestione centralizzata ordini e operatori  
✅ **Orders Planner** - Creazione e modifica ordini con lotti  
✅ **Warehouse Management** - Inventario real-time, alerting, import/export CSV  
✅ **Operators Dashboard** - Vista dedicata per operatori sul campo  
✅ **Company Settings** - Configurazione giorni/orari consegna, festivi  
✅ **Backup Management** - Backup automatico + sincronizzazione NAS  
✅ **API REST** - 80+ endpoint per integrazioni  
✅ **Autenticazione JWT** - Sicura e stateless  

### 📦 Struttura

```
Backend (Express + TypeScript)
├── Controllers (logic)
├── Routes (API endpoints)
├── Middleware (auth, validation)
├── Database (Prisma + SQLite)
└── Services (CSV, Backup, DB utilities)

Frontend (HTML/CSS/JS)
├── Admin Dashboard
├── Orders Planner
├── Warehouse Management
├── Company Settings
├── Operators Carousel
└── Backup Management

Docker
├── Dockerfile (optimized 2-stage build)
├── docker-compose.yml (orchestration)
└── docker-start.sh (startup script)
```

### 🚀 Deployment

- **Locale**: `localhost:5000` (Docker Desktop)
- **NAS**: `192.168.1.248:5000` (192.168.1.248)
- **Credenziali**: master/masterpass

### 📊 Database

7 modelli Prisma: User, Order, OrderProduct, InventoryItem, Operator, Trip, CompanySettings

### 🔒 Sicurezza

- JWT authentication con 24h TTL
- Password hashing bcrypt (10 rounds)
- CORS whitelist
- Input validation
- Environment variables per secrets

### 📈 Performance

- Build cache ottimizzato (60% più veloce)
- .dockerignore esaustivo (60+ entries)
- Dockerfile layers ordinati
- Query N+1 preventate
- CSV import bulk (140+ articoli in secondi)

### 📝 Documentazione

6 file di guida completa:
- Specifica progetto
- Step-by-step implementation
- Anti-pattern guide (19 errori + soluzione)
- Quick reference + commands
- Indice navigazione

---

**Versione**: v1.0.1  
**Status**: ✅ Production Ready  
**Team**: Sviluppo Node.js + DevOps  
**Note**: Progetto scalabile, maintainable, e battle-tested
