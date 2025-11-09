# 🎯 Molino Briganti Task Manager

Applicazione web completa per la gestione dei compiti con architettura **Master-Slave**.

## 🚀 Quick Start

### 1. Avvia il Server

```bash
cd task-manager-app
npm start
```

Server disponibile su: `http://localhost:5000`

### 2. Testa l'API

```bash
cd task-manager-app
./QUICK_TEST.sh
```

### 3. Accedi come Master

```bash
Username: master
Password: masterpass
```

## 📋 Caratteristiche Implementate

### ✅ Master Control
- Creare compiti con titolo, descrizione, data/ora, operatore, tempo stimato
- Modificare compiti
- Cancellare compiti
- Visualizzare TUTTI i compiti
- Leggere note degli operatori
- Registrare nuovi operatori

### ✅ Multi-Slave Support
- Più operatori contemporaneamente
- Visualizzano solo compiti assegnati
- Aggiungono note
- Spuntano completamento
- Registrano tempo effettivo

### ✅ Autenticazione Sicura
- Login con JWT (8h expire)
- Password hashata con bcrypt
- Role-based access control
- Token bearer authentication

### ✅ REST API
- 8 endpoint principali
- CORS abilitato
- JSON request/response
- Error handling completo

### ✅ Database
- SQLite3 file-based
- Schema Prisma ottimizzato
- Auto-initialization
- Retrocompatibile (Jellybean+)

## 📁 Struttura Principale

```
task-manager-app/
├── server/src/          # TypeScript source
├── server/dist/         # Compiled JavaScript
├── server/prisma/       # Database + Seed
├── package.json         # Dependencies
├── README.md            # Full documentation (IT)
├── API_DOCUMENTATION.md # API reference
└── QUICK_TEST.sh        # Test script
```

## 🔐 Credenziali

**Master**:
- Username: `master`
- Password: `masterpass`

## 📞 Documentazione

| File | Contenuto |
|------|-----------|
| `task-manager-app/README.md` | Guida completa |
| `task-manager-app/API_DOCUMENTATION.md` | Endpoint reference |
| `task-manager-app/SETUP_COMPLETE.md` | Dettagli tecnici |
| `task-manager-app/INSTALLATION_SUCCESS.md` | Recap setup |
| `PROGETTO_COMPLETATO.md` | Summary progetto |

## 🧪 Test

Tutti i test passano ✅

```bash
cd task-manager-app
./QUICK_TEST.sh
```

Test automatici:
- Health check
- Login
- Create task
- Get tasks
- Update task
- Add notes
- Get notes
- Register user
- Delete task

## 🛠️ Comandi Utili

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Database
npm run prisma:seed
npm run prisma:generate

# Quick start
./start.sh [dev|prod|build|seed|stop]
```

## 📱 Compatibilità

- ✅ Android API 16+ (Jellybean)
- ✅ Modern Browsers
- ✅ REST API standard
- ✅ JSON payload

## 🎓 Esempio Utilizzo

```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -d '{"username":"master","password":"masterpass"}'

# 2. Crea compito
curl -X POST http://localhost:5000/api/tasks \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "title":"Manutenzione",
    "estimatedMinutes":120
  }'

# 3. Leggi compiti
curl -X GET http://localhost:5000/api/tasks \
  -H "Authorization: Bearer TOKEN"
```

## 🎉 Status

**✅ PRODUCTION READY**

- Backend: Funzionante
- Database: Inizializzato
- API: Testata
- Documentazione: Completa
- Retrocompatibilità: Confermata

## 📞 Support

Consulta i file di documentazione nella directory `task-manager-app/`

---

**Versione**: 1.0.0  
**Data**: 9 Novembre 2025  
**Status**: ✅ Ready to Deploy
