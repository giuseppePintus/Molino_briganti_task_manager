# Quick Build e Deploy - Comandi Rapidi

**Versione**: v1.0.61 (Jan 5, 2026 - Prisma v6 Fix + Docker Build on NAS)

## 🔧 METODO CORRETTO - Deploy Jan 5, 2026 (FINALE)

### ⚠️ CORREZIONI CRITICHE (Prisma v6 Fix)

1. **Schema Prisma** - DEVE avere URL visibile (NON commentata):
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")  // ✅ OBBLIGATORIO per Prisma v6
}
```

2. **Dockerfile** - DEVE avere `npx prisma generate`:
```dockerfile
RUN npm install prisma@6.19.0

# ✅ CRITICO: Genera Prisma Client PRIMA di copiare dist/
RUN npx prisma generate --schema=./server/prisma/schema.prisma

COPY public/ public/
COPY server/dist/ ./server/dist/

# ✅ CMD CORRETTO - node server/dist/index.js (non dist/index.js!)
CMD ["node", "server/dist/index.js"]
```

3. **Container** - DEVE avere volumi e env vars:
```bash
docker run -d --name molino-app -p 5000:5000 \
  -e NODE_ENV=production \
  -e DATABASE_URL='file:/share/Container/data/molino/tasks.db' \
  -e BACKUP_DIR='/share/Container/backups/database' \
  -v /share/Container/data/molino:/share/Container/data/molino \
  -v /share/Container/backups/database:/backups/database \
  molino-app:v1.0.61
```

## � Deploy Completo NAS (METODO CORRETTO)

**Strategia**: Build Docker **DIRETTAMENTE sul NAS** (veloce e senza transfer di file enormi)

```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app

# 1. Compila localmente
npm run build

# 2. Copia file sorgente su NAS
scp Dockerfile admin@192.168.1.248:/share/Container/
scp package.json admin@192.168.1.248:/share/Container/
scp package-lock.json admin@192.168.1.248:/share/Container/
scp -r server/dist admin@192.168.1.248:/share/Container/server/
scp -r server/prisma admin@192.168.1.248:/share/Container/server/
scp -r public admin@192.168.1.248:/share/Container/

# 3. Build Docker immagine DIRETTAMENTE su NAS
ssh admin@192.168.1.248 "
  cd /share/Container
  /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker build -t molino-app:v1.0.61 .
"

# 4. Stop container vecchio e crea uno nuovo
ssh admin@192.168.1.248 "
  /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker stop molino-app 2>/dev/null
  /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker rm molino-app 2>/dev/null
  
  # Crea cartelle dati
  mkdir -p /share/Container/data/molino
  mkdir -p /share/Container/backups/database
  
  # Crea container CON environment variables e volumi
  /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker run -d \
    --name molino-app \
    -p 5000:5000 \
    -e NODE_ENV=production \
    -e DATABASE_URL='file:/share/Container/data/molino/tasks.db' \
    -e BACKUP_DIR='/share/Container/backups/database' \
    -v /share/Container/data/molino:/share/Container/data/molino \
    -v /share/Container/backups/database:/backups/database \
    molino-app:v1.0.61
  
  sleep 5
  /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker logs molino-app | head -20
"

# 5. Verifica che è online
curl http://192.168.1.248:5000/api/health
# Risposta: {"status":"ok","version":"1.0.56"...}
```

**Tempo totale**: ~5-10 minuti (build su NAS)
**Vantaggi**:
- ✅ Build ARM64 nativo sul NAS
- ✅ Niente transfer di archivi grandi
- ✅ Prisma client generato correttamente
- ✅ Server online immediatamente

## 🔧 Comandi Utili NAS

### Percorsi Importanti
- **Docker path**: `/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker`
- **Container name**: `molino-app`
- **Deploy directory**: `/share/Container/`
- **NAS IP**: `192.168.1.248`
- **SSH User**: `admin`
- **SSH Password**: `***REDACTED_NAS_PASSWORD***`

### Comandi Docker NAS
```bash
# Lista container
ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker ps -a"

# Lista immagini disponibili
ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker images"

# Restart container
ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-app"

# Stop container
ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker stop molino-app"

# Start container
ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker start molino-app"

# Logs container
ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker logs molino-app"

# Logs realtime
ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker logs -f molino-app"

# Ricrea container (se eliminato accidentalmente)
ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker run -d --name molino-app -p 5000:5000 -v /share/Container/public:/app/public -v /share/Container/server/dist:/app/server/dist -v /share/Container/server/prisma:/app/server/prisma -v /share/Container/data/molino:/data/molino -e NODE_ENV=production -e PORT=5000 --restart unless-stopped task-manager-nas:1.0.18"

# Verifica versione via API
ssh admin@192.168.1.248 "curl -s http://localhost:5000/api/version"
```

## 🔧 SOLUZIONI TROVATE

### ✅ Prisma v6 + Dockerfile + CMD (Jan 5, 2026 - CRITICO!)
**Problema**: Build Docker fallisce con "Argument 'url' is missing in datasource block"

**Cause Identificate**:
1. Schema Prisma aveva URL commentata: `// url = env("DATABASE_URL")`
2. Dockerfile non eseguiva `npx prisma generate` durante build
3. CMD sbagliato nel Dockerfile: `CMD ["node", "dist/index.js"]` invece di `CMD ["node", "server/dist/index.js"]`

**Soluzione Implementata**:
1. **Schema Prisma** - Uncomment URL:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

2. **Dockerfile** - Aggiungi Prisma generate:
```dockerfile
RUN npm install prisma@6.19.0
RUN npx prisma generate --schema=./server/prisma/schema.prisma
COPY public/ public/
COPY server/dist/ ./server/dist/
CMD ["node", "server/dist/index.js"]
```

3. **Build su NAS** - Non transfer di file, build direttamente:
```bash
scp Dockerfile package.json ... admin@192.168.1.248:/share/Container/
ssh admin@192.168.1.248 "cd /share/Container && docker build -t molino-app:v1.0.61 ."
```

**Risultato**: ✅ Container UP and HEALTHY su http://192.168.1.248:5000
### ✅ Problema: Logo non visualizzato + flicker su browser (Session 12 Dec 2025)

**Soluzione Implementata** (FINALE):
1. **DISABILITATA** la modifica dinamica del logo in `applyCompanyBranding()`
2. Logo resta come HTML statico: `<img src="images/logo INSEGNA.png" id="headerLogoImg">`
3. Non viene aggiunto nessun timestamp o cache-busting alla query string

**Perché Funziona**:
- Pagina `customers-management.html` (che non aveva mai il problema) usa lo stesso approccio: logo statico senza modifiche dinamiche
- La modifica dinamica era la CAUSA del flicker, non la soluzione
- Browser cache funziona correttamente quando non c'è continua modifica di src

**Codice Finale** (admin-dashboard.html, operator-dashboard.html):
```javascript
function applyCompanyBranding(settings) {
    // Logo modification DISABLED to prevent flicker
    // Logo stays static as: <img src="images/logo INSEGNA.png">
    
    // Only update other settings (page title)
    if (settings.businessName) {
        document.title = settings.businessName + ' - Dashboard';
    }
}
```

**Risultato**: Logo visualizzato costantemente senza flicker ✅

### ✅ Problema: Trip Creation API Failing with "Foreign key constraint violated" (Session 11 Dec 2025)
**Root Cause**: Missing `sequence` TEXT column in Trip table (database schema mismatch with Prisma schema)

**Soluzione Permanente**:
1. Aggiungi colonna `sequence` al CREATE TABLE Trip in `server/src/services/databaseInit.ts`:
   ```sql
   "sequence" TEXT,
   ```

2. Rigenera Prisma Client nel container:
   ```bash
ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker exec molino-app npm run prisma:generate"
```

3. Ricrea container CON environment variable DATABASE_URL:
   ```bash
   ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker rm molino-app"
   ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker run -d --name molino-app -p 5000:5000 -e DATABASE_URL='file:/app/server/prisma/data/tasks.db' -e NODE_ENV='production' -e BACKUP_DIR='/share/Container/data/molino/backups/database' -v /share/Container/public:/app/public -v /share/Container/server/dist:/app/server/dist -v /share/Container/server/prisma:/app/server/prisma -v /share/Container/data/molino:/share/Container/data/molino --restart always task-manager-nas:1.0.18"

**Quick Fix Script** (se la colonna manca nel DB esistente):
```javascript
// save as add-sequence-column.js
const Database = require('better-sqlite3');
const db = new Database('/app/server/prisma/data/tasks.db');
try {
  db.exec(`ALTER TABLE "Trip" ADD COLUMN "sequence" TEXT DEFAULT NULL;`);
  console.log('✅ sequence column added');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}
db.close();
```

### ✅ Problema: DATABASE_URL non trovato da Prisma nel container
**Causa**: .env file non presente nel container, DATABASE_URL non passato via docker run

**Soluzione**:
1. Copia .env nel container:
   ```bash
   scp .env vsc@192.168.1.248:/share/Container/
   ```

2. O passa via docker run (PREFERITO):
   ```bash
   -e DATABASE_URL='file:/app/server/prisma/data/tasks.db'
   ```

### 🐛 Troubleshooting

#### Problema: Versione non si aggiorna dopo deploy
**Causa**: Il container è stato eliminato e stava leggendo l'immagine vecchia con versione embedded.

**Soluzione**:
1. Controlla se il container esiste:
   ```bash
   ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker ps -a | grep molino-app"
   ```

2. Se non esiste, ricrea il container con le corrette volume mounts:
   ```bash
   ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker run -d --name molino-app -p 5000:5000 -v /share/Container/public:/app/public -v /share/Container/server/dist:/app/server/dist -v /share/Container/server/prisma:/app/server/prisma -v /share/Container/package.json:/app/package.json task-manager-nas:1.0.18"
   ```

3. Verifica che la versione sia corretta:
   ```bash
   ssh vsc@192.168.1.248 "curl -s http://localhost:5000/api/version"
   ```

**Nota**: Le volume mounts garantiscono che il container legga i file aggiornati da `/share/Container/` anziché usare versioni embedded nell'immagine Docker.

## 🗄️ Database Locale

### Eliminare tutti i task e ordini
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app
$env:DATABASE_URL="file:./server/prisma/data/tasks.db"
cd server
npx ts-node -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); (async () => { const t = await p.task.deleteMany({}); const o = await p.order.deleteMany({}); console.log('✅ Task:', t.count, 'Ordini:', o.count); await p.\$disconnect(); })()"
```

### Percorso Database Locale
- **Database URL**: `file:./server/prisma/data/tasks.db`
- **Path assoluto**: `C:\Users\manue\Molino_briganti_task_manager\task-manager-app\server\prisma\data\tasks.db`

## 🔄 Server Locale

### Avviare server locale
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app
Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim('"'), 'Process') } }
node server/dist/index.js
```

### Fermare server locale
```powershell
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
```

## 📝 Note
- **Password SSH richiesta**: 2 volte durante il deploy (scp + ssh)
- **Tempo deploy**: ~20 secondi
- **Archivio size**: ~7 MB
- **Non serve build Docker**: aggiorniamo solo i file nel container esistente

## ⚠️ IMPORTANTE: npm run build vs npx tsc
**SBAGLIATO** ❌:
```powershell
cd server; npx tsc; cd ..  # Compila solo TypeScript, perde le modifiche agli HTML
```

**CORRETTO** ✅:
```powershell
npm run build  # Compila TypeScript + include tutto quello che serve
```

Se usi `npx tsc` direttamente nel server folder, le modifiche ai file HTML non verranno incluse nel tar e non si vedranno sul server reale!

## 🔄 Sincronizzazione File Critici nel Container

### ⚠️ PROBLEMA RISOLTO (Jan 1, 2026)
**Prima**: Il tar estratto conteneva file vecchi. Anche se il file sorgente era aggiornato, il container continuava a servire la versione vecchia.

**Adesso**: Lo script `quickbuild-nas.ps1` sincronizza i file critici DENTRO il container dopo l'estrazione:

```bash
# Step 6: Sincronizza file critici DENTRO il container
docker cp /share/Container/public/orders-planner.html molino-app:/app/public/orders-planner.html
docker cp /share/Container/package.json molino-app:/app/package.json
docker restart molino-app
```

### File Sincronizzati
1. **`public/orders-planner.html`** - UI principale con modali e lotti
2. **`package.json`** - Versione API (letto da `/api/version`)

### Come Funziona
1. Il tar è estratto in `/share/Container/` (bind mount visibile al container)
2. I file vengono copiati DENTRO il container con `docker cp`
3. Il container riavvia e legge i file aggiornati
4. L'utente vede immediatamente le modifiche (no cache issues)

### Verifica Versione API
```bash
curl http://192.168.1.248:5000/api/version
# {"version":"1.0.51","date":"2026-01-01"}
```
