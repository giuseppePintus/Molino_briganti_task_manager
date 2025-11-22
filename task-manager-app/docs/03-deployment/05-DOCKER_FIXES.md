# Fix Docker Infrastructure - Changelog

## 🔧 Problemi Risolti

### 1. Database "file not found" Error
**Problema:** Il database SQLite non veniva creato automaticamente al primo avvio in Docker, causando "Database file not found" nel log.

**Causa:** 
- Prisma non crea automaticamente il file del database
- La directory `/app/server/prisma/data` esisteva ma era vuota
- Non c'era un'inizializzazione esplicita del database al startup

**Soluzione Implementata:**
1. ✅ Aggiunto `chmod -R 755` al Dockerfile per i permessi corretti della directory
2. ✅ Creato nuovo file `server/src/services/databaseInit.ts` che:
   - Verifica se il database è vuoto
   - Se vuoto, crea 4 utenti di default (2 admin + 2 operatori)
   - Registra le credenziali di default nel log

3. ✅ Aggiornato `server/src/index.ts`:
   - Importa la nuova funzione di inizializzazione
   - Chiama `initializeDatabaseIfEmpty()` dopo la connessione Prisma
   - Aggiunto logging dettagliato del processo di startup

4. ✅ Aggiornato `Dockerfile`:
   - Copia `.env.docker` → `server/.env` nella build
   - Aggiunto `chmod -R 755` per il database directory
   - Migliore logging del processo di startup

### 2. Default Operators Showing Instead of Created Users
**Problema:** Al primo caricamento della pagina orders-planner, venivano mostrati operatori di default invece di quelli creati nel database.

**Causa Diagnosticata:**
- Gli endpoint API `/auth/operators/public` e `/auth/admins/public` rispondevano lentamente o fallivano
- Il timeout di caricamento era troppo breve
- Il fallback ai default era immediato
- Tuttavia, quando l'utente aggiungeva un task, i dati da localStorage sincronizzavano gli operatori corretti

**Soluzione Implementata:**
1. ✅ Migliorato logging in `loadOperators()` in orders-planner.html:
   - Log della fase di cache check
   - Log della risposta API (status code)
   - Log del numero di operatori/admin ricevuti
   - Log del metodo di caricamento (API vs cache vs default)

2. ✅ Aggiunto `Content-Type` header alle richieste fetch
3. ✅ Corretto il fallback: `role: 'operator'` → `role: 'slave'` per consistenza col server
4. ✅ Aggiunto supporto per localStorage come cache affidabile

## 📝 Utenti di Default Creati Automaticamente

Quando il database è vuoto, il server crea automaticamente:

### Amministratori (Master Users)
- **Username:** Admin Mario | **Email:** mario@molino.it | **Password:** admin123
- **Username:** Admin Lucia | **Email:** lucia@molino.it | **Password:** admin123

### Operatori
- **Username:** Operatore Paolo | **Email:** paolo@molino.it | **Password:** operator123
- **Username:** Operatore Sara | **Email:** sara@molino.it | **Password:** operator123

⚠️ **IMPORTANTE:** Queste sono credenziali di DEFAULT per il primo avvio. 
In produzione, cambiarle immediatamente dalla sezione "Gestione Admin/Operatori"

## 🚀 Come Funziona Ora in Docker

1. **Container Startup:**
   ```
   Docker → server/src/index.ts → initializeDatabaseIfEmpty()
   ```

2. **Se DB è vuoto:**
   - Crea 4 utenti di default
   - Salva nel database SQLite
   - Log: "✅ Default users created"

3. **Se DB ha già dati:**
   - Salta l'inizializzazione
   - Log: "📊 Database initialized with N users"

4. **Caricamento degli operatori:**
   - orders-planner.html chiama `loadOperators()`
   - Prova cache localStorage
   - Se niente in cache, chiama API `/auth/operators/public` e `/auth/admins/public`
   - Se API fallisce, usa i default dal server

## 📊 Volume Persistence

Nel `docker-compose.yml`:
```yaml
volumes:
  db_data:/app/server/prisma/data
```

Questo garantisce che il database persiste tra i riavvii del container.

## 🔍 Debug - Come Verificare

1. **Controllare i log del container:**
   ```bash
   docker logs molino-briganti-task-manager
   ```
   Dovresti vedere:
   ```
   🗄️ Initializing database schema...
   ✅ Database connected successfully
   🌱 Database empty, initializing with default users...
   ✅ Default users created:
      📌 Admin Mario (Admin) - Password: admin123
      📌 Admin Lucia (Admin) - Password: admin123
      👤 Operatore Paolo (Operator) - Password: operator123
      👤 Operatore Sara (Operator) - Password: operator123
   ```

2. **Verificare il file del database:**
   ```bash
   docker exec molino-briganti-task-manager ls -la /app/server/prisma/data/
   ```
   Dovresti vedere `tasks.db` con permessi `755`

3. **Verificare gli operatori nel browser:**
   - Apri Web UI
   - Console DevTools
   - Cerca il log: "✅ Operatori e Admin caricati"

## 🔐 File di Configurazione

Il Dockerfile ora copia automaticamente `.env.docker` → `server/.env`:
- DATABASE_URL: `file:/app/server/prisma/data/tasks.db`
- PORT: `5000`
- JWT_SECRET: configurabile via env var

## ✅ Testing Successivo

Per testare il fix:

```bash
# Build nuova immagine
docker-compose build

# Avvia il container
docker-compose up -d

# Verifico i log
docker-compose logs -f molino-app

# Accedi a http://localhost:5000
# Verifica che gli operatori siano quelli del server (non i default)
```

## 📋 File Modificati

- ✅ `Dockerfile` - Aggiunto chmod 755, copia .env.docker
- ✅ `server/src/index.ts` - Aggiunta inizializzazione database
- ✅ `server/src/services/databaseInit.ts` - NUOVO FILE
- ✅ `public/orders-planner.html` - Migliorato logging e fallback

## 🎯 Risultato Atteso

Dopo questi fix:
1. ✅ Database viene creato automaticamente al primo avvio
2. ✅ Utenti di default vengono creati automaticamente
3. ✅ orders-planner.html carica gli operatori dal database (non i default)
4. ✅ Data persiste tra i riavvii del container
5. ✅ Nessun "Database file not found" error
