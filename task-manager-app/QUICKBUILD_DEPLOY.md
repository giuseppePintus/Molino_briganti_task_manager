# Quick Build e Deploy - Comandi Rapidi

**Versione**: v1.0.21 (Dec 11, 2025 - DB Schema Fix)

## 📋 Quick Build Locale (solo compilazione)
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app\server
npx tsc
```

## 🚀 Quick Build + Deploy NAS (completo)
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app

# 1. Compila TypeScript
cd server; npx tsc; cd ..

# 2. Crea archivio
tar -czf task-manager-update.tar.gz public server/dist server/prisma package.json

# 3. Upload al NAS
scp task-manager-update.tar.gz vsc@192.168.1.248:/share/Container/

# 4. Estrai file sul NAS
ssh vsc@192.168.1.248 "cd /share/Container && tar -xzf task-manager-update.tar.gz"

# 5. Riavvia container
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-app"
```

## ⚡ Quick Build One-Liner
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app; cd server; npx tsc; cd ..; tar -czf task-manager-update.tar.gz public server/dist server/prisma package.json; scp task-manager-update.tar.gz vsc@192.168.1.248:/share/Container/; ssh vsc@192.168.1.248 "cd /share/Container && tar -xzf task-manager-update.tar.gz && /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-app"; Write-Host "`n✅ DEPLOY COMPLETATO!" -ForegroundColor Green
```

## 🔧 Comandi Utili NAS

### Percorsi Importanti
- **Docker path**: `/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker`
- **Container name**: `molino-app`
- **Deploy directory**: `/share/Container/`
- **NAS IP**: `192.168.1.248`
- **SSH User**: `vsc`
- **SSH Password**: `vsc12345`

### Comandi Docker NAS
```bash
# Lista container
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker ps -a"

# Lista immagini disponibili
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker images"

# Restart container
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-app"

# Stop container
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker stop molino-app"

# Start container
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker start molino-app"

# Logs container
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker logs molino-app"

# Logs realtime
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker logs -f molino-app"

# Ricrea container (se eliminato accidentalmente)
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker run -d --name molino-app -p 5000:5000 -v /share/Container/public:/app/public -v /share/Container/server/dist:/app/server/dist -v /share/Container/server/prisma:/app/server/prisma -v /share/Container/package.json:/app/package.json task-manager-nas:1.0.18"

# Verifica versione via API
ssh vsc@192.168.1.248 "curl -s http://localhost:5000/api/version"
```

## 🔧 SOLUZIONI TROVATE (Session 11 Dec 2025)

### ✅ Problema: Trip Creation API Failing with "Foreign key constraint violated"
**Root Cause**: Missing `sequence` TEXT column in Trip table (database schema mismatch with Prisma schema)

**Soluzione Permanente**:
1. Aggiungi colonna `sequence` al CREATE TABLE Trip in `server/src/services/databaseInit.ts`:
   ```sql
   "sequence" TEXT,
   ```

2. Rigenera Prisma Client nel container:
   ```bash
   ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker exec molino-app npm run prisma:generate"
   ```

3. Ricrea container CON environment variable DATABASE_URL:
   ```bash
   ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker rm molino-app"
   ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker run -d --name molino-app -p 5000:5000 -e DATABASE_URL='file:/app/server/prisma/data/tasks.db' -e NODE_ENV='production' -v /share/Container/public:/app/public -v /share/Container/server/dist:/app/server/dist -v /share/Container/server/prisma:/app/server/prisma -v /share/Container/data/molino/backups/database:/data/molino/backups/database --restart always task-manager-nas:1.0.18"
   ```

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
   ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker ps -a | grep molino-app"
   ```

2. Se non esiste, ricrea il container con le corrette volume mounts:
   ```bash
   ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker run -d --name molino-app -p 5000:5000 -v /share/Container/public:/app/public -v /share/Container/server/dist:/app/server/dist -v /share/Container/server/prisma:/app/server/prisma -v /share/Container/package.json:/app/package.json task-manager-nas:1.0.18"
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
