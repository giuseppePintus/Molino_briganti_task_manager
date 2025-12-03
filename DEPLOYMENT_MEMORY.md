# 📋 DEPLOYMENT MEMORY - NON DIMENTICARE!

## ✅ FUNZIONANTE - DA NON TOCCARE

### CSV Import (RISOLTO - 01/12/2025)
- **Frontend**: `public/js/inventory-manager.js` - Funziona con FormData file upload
- **Backend**: `server/src/services/inventoryService.ts` - Include `reserved: 0` nel create
- **Route**: `server/src/routes/inventory.ts` - Multer correttamente configurato
- **Status**: ✅ FUNZIONANTE - Gli articoli vengono importati correttamente da CSV

### Docker Deployment - NAS (QNAP)
**VERSIONE CORRENTE**: 📌 Tag con VERSION, NON "latest"!
- Docker image: molino-task-manager:v1.0.0 (o versione specifica)
- Command: `docker build -t molino-task-manager:v1.0.0 -f Dockerfile .`

**Percorso corretto NAS**:
- NAS IP: 192.168.1.248
- User: vsc (password: vsc12345)
- Docker binary: `/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/docker`
- Docker Compose: `/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/docker compose`
- Working dir NAS: `~/molino-app`
- Data dir NAS: `~/molino-data` (monta a `/data/molino` nel container)
- Backups dir NAS: `~/molino-backups`

**docker-compose.yml - VERSIONE CORRETTA**:
```yaml
volumes:
  # SOLO questa riga - senza mount del prisma!
  - ../molino-data:/data/molino:rw
```
❌ **NON METTERE**: `./server/prisma:/app/server/prisma:ro` (rompe il schema!)

**Upload a NAS - COMANDO ESATTO**:
1. Build locale: `docker build -t molino-task-manager:v1.0.0 -f Dockerfile .`
2. Export: `docker save molino-task-manager:v1.0.0 -o molino-task-manager-v1.0.0.tar`
3. Upload SCP: `scp molino-task-manager-v1.0.0.tar vsc@192.168.1.248:~/molino-app/`
4. SSH on NAS:
   ```bash
   cd ~/molino-app
   /share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/docker load -i molino-task-manager-v1.0.0.tar
   /share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/docker compose down
   /share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/docker compose up -d
   ```

---

## ⚠️ CRITICAL ISSUES RESOLVED

### Database Schema Issue (01/12/2025)
- **Problema**: Colonna `reserved` non esiste nel database SQLite
- **Errore**: P2022 - "The column `reserved` does not exist in the current database"
- **Causa**: docker-compose.yml montava `./server/prisma` read-only, cancellando il file dalla directory
- **Soluzione**: RIMUOVERE il mount di prisma dal docker-compose.yml
- **Verifica**: Log deve mostrare "✅ Database schema synchronized" non "❌ Database schema sync error"

### Password NAS
- User: vsc
- Password: vsc12345
- MEMORIZZATO DEFINITIVAMENTE

---

## 📝 VERSIONAMENTO

### Ultima versione deployata: v1.0.0 (01/12/2025 18:38 UTC+1)
- CSV import: ✅ WORKING
- Database schema: ✅ SYNCED
- Server: ✅ RUNNING at port 5000
- Default users: ✅ INITIALIZED (Manuel/123, etc.)

### Incrementare versione per:
1. Nuove feature completate
2. Bug fix critici
3. Modifiche al schema database
4. Cambiamenti alle API

---

## 🚨 REGOLE D'ORO

1. **VERSIONI**: Sempre versioni specifiche (v1.0.0, v1.0.1, v1.1.0) - MAI "latest"
2. **DOCKER-COMPOSE**: Se modificato, testare LOCAL prima di uploadare a NAS
3. **PRISMA SCHEMA**: Se modificato, ricrea il database (delete tasks.db + docker restart)
4. **UPLOADS CSV**: Testare sempre localmente prima di NAS
5. **MEMORIA**: Consultare questo file PRIMA di ogni modifica

---

## ✅ Procedura di verifica pre-deploy

Prima di deployare a NAS:
1. ✅ Build locale e test
2. ✅ npm run build (TypeScript compilation)
3. ✅ docker build con versione specifica
4. ✅ Testare un import da CSV localmente
5. ✅ SOLO DOPO: upload a NAS
6. ✅ Verificare logs: "Database schema synchronized" e "Server is running on port 5000"

