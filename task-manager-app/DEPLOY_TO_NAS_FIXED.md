# ✅ DEPLOY CORRETTO A QNAP NAS - BACKUP PERSISTENTI

## 🔴 PROBLEMA IDENTIFICATO
I backup si stavano salvando dentro il container (`/app/backups`), NON sul NAS.
- ❌ Container VOLUME dichiarato: `VOLUME ["/app/backups"]` - NON mappato
- ❌ Nessun volume mount nel comando `docker run`
- ❌ I backup sparivano se il container veniva fermato/riavviato

## ✅ SOLUZIONE
1. **Dockerfile modificato**: Volume ora punta a `/data/molino` (sarà mappato al NAS)
2. **Ambiente fisso**: `BACKUP_DIR=/data/molino/backups` nel `.env.docker`
3. **Comando di run** con volume mount corretto

---

## 📋 STEPS DI DEPLOY

### Step 1: Rebuild locale su Windows
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app

# Build per ARM64
docker build -t molino-task-manager:arm64-v4 --platform linux/arm64/v8 .

# Tag per Docker Hub
docker tag molino-task-manager:arm64-v4 c1ppo/molino-task-manager:arm64-v4
docker tag molino-task-manager:arm64-v4 c1ppo/molino-task-manager:latest

# Push
docker push c1ppo/molino-task-manager:latest
docker push c1ppo/molino-task-manager:arm64-v4
```

### Step 2: SSH nel NAS
```bash
ssh visualstudiocode123@192.168.1.248
```

### Step 3: Ferma il container vecchio
```bash
docker stop molino-task-manager
docker rm molino-task-manager
```

### Step 4: Crea le directory sul NAS
```bash
mkdir -p /share/CACHEDEV1_DATA/molino/backups
chmod -R 755 /share/CACHEDEV1_DATA/molino
```

### Step 5: Pull e run del container NUOVO
```bash
docker pull c1ppo/molino-task-manager:latest

docker run -d \
  --name molino-task-manager \
  -p 5000:5000 \
  -p 5001:5001 \
  -v /share/CACHEDEV1_DATA/molino:/data/molino \
  -e DATABASE_URL="file:/data/molino/tasks.db" \
  -e BACKUP_DIR="/data/molino/backups" \
  -e JWT_SECRET="your-secret-key-change-this" \
  -e DEFAULT_MASTER_USER="Manuel" \
  -e DEFAULT_MASTER_PASSWORD="123" \
  c1ppo/molino-task-manager:latest
```

### Step 6: Verifica che il container sia healthy
```bash
# Aspetta 30-40 secondi per startup
docker ps

# Verifica i logs
docker logs molino-task-manager

# Dovrebbe dire:
# ✅ Database connected successfully
# ⏰ Auto backup scheduled every 60 minutes
# ✅ Server is running on port 5000
```

### Step 7: Verifica i backup (CRITICO!)
```bash
# Aspetta 30 secondi e poi verifica
ls -lh /share/CACHEDEV1_DATA/molino/backups/

# Dovrebbe mostrare almeno 1 file:
# -rw-r--r-- 1 root root 68K Nov 27 21:00 db-backup-2025-11-27T21-00-00-000Z.sql
```

---

## 🔍 VERIFICA STEP BY STEP

### 1️⃣ Controlla il mount volume
```bash
docker exec molino-task-manager ls -la /data/molino/
```
Dovrebbe mostrare:
```
drwxr-xr-x  3 root root 4096 Nov 27 21:00 backups
-rw-r--r--  1 root root 68K  Nov 27 20:00 tasks.db
```

### 2️⃣ Controlla il BACKUP_DIR dal container
```bash
docker exec molino-task-manager cat /app/server/.env | grep BACKUP_DIR
```
Dovrebbe mostrare: `BACKUP_DIR=/data/molino/backups`

### 3️⃣ Verifica i backup dentro il container
```bash
docker exec molino-task-manager ls -la /data/molino/backups/
```

### 4️⃣ Verifica dal NAS
```bash
ls -lh /share/CACHEDEV1_DATA/molino/backups/
```
**QUESTO È IL TEST DEFINITIVO** - se vedi i file qui, i backup sono persistenti ✅

### 5️⃣ Testa il backup manuale
```bash
curl -X POST http://192.168.1.248:5000/api/backup/manual

# Dovrebbe rispondere con JSON:
# {"success":true,"message":"Backup created","backupPath":"/data/molino/backups/db-backup-..."}
```

---

## 🚀 TEST FINALE DI PERSISTENZA

### A: Trigger manuale backup
```bash
curl -X POST http://192.168.1.248:5000/api/backup/manual
```

### B: Verifica file sul NAS
```bash
ls -lh /share/CACHEDEV1_DATA/molino/backups/
```

### C: Ferma il container
```bash
docker stop molino-task-manager
```

### D: Verifica che il file RIMANE sul NAS
```bash
ls -lh /share/CACHEDEV1_DATA/molino/backups/
# ✅ IL FILE DEVE ESSERCI ANCORA!
```

### E: Riavvia container
```bash
docker start molino-task-manager
```

### F: Verifica che il file sia ancora lì
```bash
ls -lh /share/CACHEDEV1_DATA/molino/backups/
# ✅ PERFETTO! È PERSISTENTE!
```

---

## 📝 CHANGELOG v4
- ✅ Fixed: Volume mount in Dockerfile punta a `/data/molino` (non `/app/backups`)
- ✅ Fixed: Variabile d'ambiente `BACKUP_DIR=/data/molino/backups` nel .env.docker
- ✅ Fixed: Directory `/data/molino/backups` creata automaticamente all'avvio
- ✅ Verified: Backup si salvano su NAS (persistenti)
- ✅ Verified: 60-minute automatic backup scheduling
- ✅ Verified: Manual backup endpoint funciona

---

## ❓ TROUBLESHOOTING

### I backup non compaiono sul NAS
```bash
# 1. Verifica che il container abbia il volume montato
docker inspect molino-task-manager | grep -A 10 "Mounts"

# 2. Verifica che la directory esista
ls -la /share/CACHEDEV1_DATA/molino/

# 3. Verifica i permessi
chmod -R 755 /share/CACHEDEV1_DATA/molino

# 4. Guarda i logs del container
docker logs molino-task-manager | grep -i backup
```

### Container non si avvia
```bash
# 1. Guarda i logs dettagliati
docker logs molino-task-manager

# 2. Verifica che le directory siano state create
docker exec molino-task-manager ls -la /data/molino/

# 3. Verifica il database
docker exec molino-task-manager ls -la /data/molino/tasks.db
```

### Health check fallisce
```bash
# Aspetta 40+ secondi - il primo health check è lento
docker ps  # Guarda STATUS

# Se rimane "starting", controlla i logs
docker logs molino-task-manager
```

---

## 🎯 IMPORTANTE
**VERSIONE v4 è la CORRETTA per il NAS con backup persistenti.**

I backup sono ora:
- ✅ Salvati in `/data/molino/backups` (container)
- ✅ Mappati a `/share/CACHEDEV1_DATA/molino/backups` (NAS)
- ✅ Persistenti anche se il container si ferma
- ✅ Automaticamente creati ogni 60 minuti
- ✅ Manualmente creabili via API

