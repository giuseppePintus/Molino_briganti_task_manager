# 🧪 Testing Guide - Docker Fix Verification

## Pre-requisiti
- Node.js 18+ installato
- SQLite3 installato (opzionale)
- npm dependencies installati

## Test 1: TypeScript Compilation ✅ PASSED
```bash
cd server
npm run build
```
**Risultato Atteso:**
- ✅ Nessun errore di compilazione
- ✅ File `dist/services/databaseInit.js` creato
- ✅ File `dist/index.js` include l'import di `initializeDatabaseIfEmpty`

**Stato:** ✅ **PASSED** - Compilation successful

---

## Test 2: Server Startup (Localhost Test)

### Setup
```bash
# 1. Vai nella cartella server
cd server

# 2. Crea un .env temporaneo per test locale
# (usa un database separato da quello di production)
echo "DATABASE_URL=file:./test-tasks.db" > .env
echo "JWT_SECRET=test-secret-key" >> .env
echo "PORT=5000" >> .env

# 3. Avvia il server
npm start
```

### Output Atteso - First Run (Database Empty)
```
🗄️ Initializing database schema...
📝 Database is new, running migrations...
✅ Database connected successfully
🌱 Database empty, initializing with default users...
✅ Default users created:
   📌 Admin Mario (Admin) - Password: admin123
   📌 Admin Lucia (Admin) - Password: admin123
   👤 Operatore Paolo (Operator) - Password: operator123
   👤 Operatore Sara (Operator) - Password: operator123
⚠️  IMPORTANTE: Cambia le password di default in produzione!
🔄 Checking for backups on NAS...
ℹ️ No backups available on NAS (first run)
✅ Server is running on port 5000
🌐 Web UI: http://localhost:5000
💾 Backup API: http://localhost:5000/api/backup
```

### Output Atteso - Subsequent Runs (Database Exists)
```
🗄️ Initializing database schema...
✅ Database schema already exists
✅ Database connected successfully
📊 Database initialized with 4 users
🔄 Checking for backups on NAS...
ℹ️ No backups available on NAS (first run)
✅ Server is running on port 5000
🌐 Web UI: http://localhost:5000
💾 Backup API: http://localhost:5000/api/backup
```

### Test API Endpoints
```bash
# Test 1: Health check
curl http://localhost:5000/api/health

# Test 2: Load public operators (NO AUTH required)
curl http://localhost:5000/api/auth/operators/public

# Test 3: Load public admins (NO AUTH required)
curl http://localhost:5000/api/auth/admins/public
```

**Risultati Attesi:**
```json
# Test 1 Response
{"status":"ok"}

# Test 2 & 3 Response (se il database è stato inizializzato)
[
  {"id":1,"username":"Admin Mario","role":"master","image":null},
  {"id":2,"username":"Admin Lucia","role":"master","image":null},
  {"id":3,"username":"Operatore Paolo","role":"slave","image":null},
  {"id":4,"username":"Operatore Sara","role":"slave","image":null}
]
```

---

## Test 3: Web UI - orders-planner.html

### Procedura
1. Avvia il server con `npm start`
2. Apri browser a `http://localhost:5000`
3. Apri DevTools (F12)
4. Vai su tab "Console"
5. Attendi il caricamento della pagina

### Console Output Atteso
```
✅ Operatori caricati da cache locale (riordinati): [...]
```
oppure
```
🔄 Caricamento operatori e admin dall'API pubblica...
📡 Risposta API - Operators: 200 Admins: 200
📋 Operatori ricevuti ( 2 ): [...]
📋 Admin ricevuti ( 2 ): [...]
✅ Operatori e Admin caricati dall'API pubblica. Totale: 4
```

### Verifica Visiva
- ✅ Pagina carica senza errori
- ✅ Select dropdown dei clienti mostra i client
- ✅ Select dropdown degli operatori mostra: Admin Mario, Admin Lucia, Operatore Paolo, Operatore Sara
- ✅ Nessun console error

---

## Test 4: Database File Creation

### Verifica File
```bash
# Verifica che il file database esista
ls -la server/test-tasks.db
```

**Risultato Atteso:**
```
-rw-r--r--  1 user group  12288 Nov 21 18:40 server/test-tasks.db
```

### Verifica Contenuto (opzionale, require sqlite3)
```bash
# Se hai sqlite3 installato, verifica il contenuto
sqlite3 server/test-tasks.db ".tables"
sqlite3 server/test-tasks.db "SELECT id, username, role FROM User;"
```

**Risultato Atteso:**
```
1|Admin Mario|master
2|Admin Lucia|master
3|Operatore Paolo|slave
4|Operatore Sara|slave
```

---

## Test 5: Storage Event Sync (Admin Dashboard → Orders Planner)

### Procedura
1. Apri 2 tab nel browser:
   - Tab 1: http://localhost:5000 (admin-dashboard)
   - Tab 2: http://localhost:5000/orders-planner.html (orders-planner)

2. In Tab 1 (Admin Dashboard):
   - Crea un nuovo task
   - Assegna a un operatore

3. In Tab 2 (Orders Planner):
   - Apri DevTools Console
   - Crea un order nuovo
   - Verifica che gli operatori siano quelli corretti (non i default)

### Console Output Atteso in Tab 2
```
💾 Storage event received: admin_tasks updated
[Operators automatically sync via localStorage]
```

---

## Cleanup Test

```bash
# Pulisci il database di test
rm server/test-tasks.db

# Pulisci il .env temporaneo
rm server/.env

# Ripristina il .env di produzione
cp .env.docker server/.env
```

---

## Troubleshooting

### Errore: "Database file not found"
**Causa:** Directory `/app/server/prisma/data` non esiste o non ha permessi
**Soluzione:** 
```bash
mkdir -p server/prisma/data
chmod 755 server/prisma/data
```

### Errore: "Cannot find module 'databaseInit'"
**Causa:** File non compilato
**Soluzione:** 
```bash
cd server
npm run build
```

### API endpoints return 404
**Causa:** Server non è avviato
**Soluzione:** 
```bash
cd server
npm start
```

### Default operators showing in orders-planner
**Causa:** API endpoints fallivano durante caricamento
**Soluzione:**
1. Verifica che API sia raggiungibile: `curl http://localhost:5000/api/auth/operators/public`
2. Verifica console log del server per errori
3. Forza refresh della pagina (Ctrl+F5)
4. Svuota localStorage: `localStorage.clear()`

---

## Test Checklist

- [ ] TypeScript compilation successful
- [ ] Server starts without errors
- [ ] Database file created at `server/prisma/data/tasks.db` (o `./test-tasks.db` per test)
- [ ] Default 4 users created on first run
- [ ] API endpoints `/auth/operators/public` and `/auth/admins/public` return correct data
- [ ] orders-planner.html console shows operators loaded from API/cache
- [ ] orders-planner.html dropdown shows correct operators (not defaults)
- [ ] Storage sync works between tabs
- [ ] Second server startup skips user initialization
- [ ] Database file persists after server restart

---

## 🚀 Production Deployment (Docker)

Una volta che tutti i test locali passano:

```bash
# Build Docker image
docker compose build

# Start Docker container
docker compose up -d

# Check logs
docker compose logs -f molino-app

# Verify database was created in container
docker exec molino-briganti-task-manager ls -la /app/server/prisma/data/
```

**Expected Docker Log Output:**
```
molino-app  | 🗄️ Initializing database schema...
molino-app  | 📝 Database is new, running migrations...
molino-app  | ✅ Database connected successfully
molino-app  | 🌱 Database empty, initializing with default users...
molino-app  | ✅ Default users created:
molino-app  | ✅ Server is running on port 5000
```
