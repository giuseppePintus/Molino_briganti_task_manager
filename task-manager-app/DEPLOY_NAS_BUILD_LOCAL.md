# DEPLOY NAS - Soluzione Rapida al Problema Pull da Docker Hub

## 🔴 Problema
```
Failed to pull image "docker.io/library/molino-task-manager:latest"
Error response from daemon: pull access denied for molino-task-manager
```

**Causa**: Il docker-compose sul NAS usa `image: molino-task-manager:latest` senza `build:`

---

## ✅ Soluzione: Deploy con Build Locale

### Opzione 1: Script Automatico (CONSIGLIATO - Windows PowerShell)

```powershell
# Naviga alla directory del progetto
cd c:\Users\manue\Molino_briganti_task_manager\task-manager-app

# Esegui il script di deploy
.\deploy-nas-with-build.ps1 -NasIp 192.168.1.100 -NasUser root

# Argomenti opzionali:
# -NasPort 22 (default)
```

**Cosa fa:**
1. ✅ Verifica che `docker-compose.nas.yml` abbia `build:` configurato
2. ✅ Copia il file al NAS
3. ✅ Ferma i container precedenti
4. ✅ Pulisce le immagini vecchie
5. ✅ **Fa il BUILD locale dell'immagine sul NAS** (NON il pull!)
6. ✅ Avvia i container
7. ✅ Verifica lo stato con health check

**Output atteso:**
```
🚀 Deploy su NAS - Build Locale Forzato
==========================================
NAS IP: 192.168.1.100
...
📋 Step 1: Verificando docker-compose.nas.yml locale...
✅ docker-compose.nas.yml trovato
📤 Step 2: Copiando docker-compose.nas.yml al NAS...
✅ File copiato
🛑 Step 3: Fermando container precedenti...
✅ Container fermati
🧹 Step 4: Pulendo immagini precedenti...
✅ Immagini pulite
🔨 Step 5: Costruendo immagine sul NAS...
   ⏳ Questo richiederà 5-15 minuti
   [Build progress...]
✅ Build completato
📊 Step 6: Verificando stato container...
   NAME                         STATUS
   molino-briganti-task-manager Up (healthy)
   molino-nas-backup-server     Up
🏥 Step 7: Aspettando che l'applicazione si avvii...
✅ Health check OK: {"status":"ok"}
==========================================
✅ Deploy completato con successo!
```

---

### Opzione 2: Script Manuale (per troubleshooting)

```bash
# SSH al NAS
ssh root@192.168.1.100

# Naviga alla directory app (dove hai copiato i file)
cd /nas/molino/app

# Ferma container precedenti
docker-compose -f docker-compose.nas.yml down

# Rimuovi l'immagine vecchia
docker rmi molino-task-manager:latest 2>/dev/null || true

# Build + Avvia (questo richiederà 5-15 minuti la prima volta)
docker-compose -f docker-compose.nas.yml up -d --build

# Monitora il build
docker-compose -f docker-compose.nas.yml logs -f

# Verifica lo stato quando il build è finito
docker-compose -f docker-compose.nas.yml ps
```

---

## 📋 Prerequisiti

Prima di eseguire il deploy:

### 1. I file del progetto siano già copiati sul NAS
```bash
# Dal tuo PC
scp -r c:\Users\manue\Molino_briganti_task_manager\task-manager-app\* root@192.168.1.100:/nas/molino/app/

# Verifica
ssh root@192.168.1.100 "ls /nas/molino/app/ | head -20"
```

### 2. Le directory di persistenza esistano
```bash
ssh root@192.168.1.100 "mkdir -p /data/molino/backups && chmod -R 755 /data/molino"
```

### 3. Docker sia installato e in esecuzione sul NAS
```bash
ssh root@192.168.1.100 "docker ps"
# Atteso: elenco di container (potrebbe essere vuoto)
```

---

## 🔍 Verifica Finale

Dopo il deploy, verifica che tutto funzioni:

### 1. Health Check
```bash
curl http://192.168.1.100:5000/api/health
# Atteso: {"status":"ok"}
```

### 2. Web UI
```
http://192.168.1.100:5000
Login: Manuel / 123
```

### 3. Backup API
```bash
curl http://192.168.1.100:5001/api/backup/status
# Atteso: {"success":true,"backupsCount":...}
```

### 4. I container siano in esecuzione
```bash
ssh root@192.168.1.100 "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml ps"
# Atteso:
# NAME                         STATUS
# molino-briganti-task-manager Up (healthy)
# molino-nas-backup-server     Up
```

---

## ⏱️ Tempi Stimati

- **Prima volta (Build da zero)**: 10-15 minuti
  - Download base image (node:18): 1-2 min
  - npm install dependencies: 3-5 min
  - Compilazione TypeScript: 2-3 min
  - Creazione immagine: 1-2 min

- **Deploys successivi (con cache)**: 1-2 minuti
  - Solo le modifiche al codice vengono ricompilate

---

## 🐛 Troubleshooting

### Errore: "ERROR: Service 'molino-app' failed to build"
**Causa**: Errori nel Dockerfile o file mancanti
**Soluzione**:
```bash
ssh root@192.168.1.100 "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml logs molino-app"
# Leggi l'errore e correggi il Dockerfile localmente
# Riprova il deploy
```

### Errore: "Database locked" after deploy
**Soluzione**: Il database era in uso. Ricrea da zero:
```bash
ssh root@192.168.1.100 "rm /data/molino/tasks.db"
cd /nas/molino/app
.\deploy-nas-with-build.ps1 -NasIp 192.168.1.100
```

### Container non si avvia (Exit code 1)
**Soluzione**: Vedi i log completi
```bash
ssh root@192.168.1.100 "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml logs molino-app | tail -50"
```

### Build è bloccato / nessun progresso per 5+ minuti
**Possibile**: Sta scaricando le dipendenze npm
**Soluzione**: Aspetta (prima build è lenta)
```bash
ssh root@192.168.1.100 "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml logs -f molino-app"
```

---

## 📝 Note Importanti

1. **Build locale vs Pull remoto**:
   - ❌ `image: molino-task-manager:latest` → Tenta pull (fallisce)
   - ✅ `build: { context: ., dockerfile: Dockerfile }` → Build locale (funziona)

2. **docker-compose.nas.yml vs docker-compose.yml**:
   - `docker-compose.yml`: Per Windows locale con `context: .`
   - `docker-compose.nas.yml`: Per NAS Linux, identico ma esplicitamente documentato

3. **Il Dockerfile è platform-agnostic**:
   - Funziona su Linux, Windows, macOS
   - Base image: `node:18` (disponibile per tutte le architetture)

4. **Cache layer accelera i rebuild**:
   - Primo build: ~10-15 min
   - Build successivi: ~1-2 min (se il codice cambia poco)

---

## 📦 File Rilevanti

- `docker-compose.nas.yml` - Configurazione con `build:` (per NAS)
- `docker-compose.yml` - Configurazione locale (Windows)
- `Dockerfile` - Istruzioni di build (platform-agnostic)
- `deploy-nas-with-build.ps1` - Script deployment automatico

---

## ✨ Workflow Consigliato

1. **Primo Deploy**:
   ```powershell
   .\deploy-nas-with-build.ps1 -NasIp 192.168.1.100
   ```

2. **Update Applicazione** (modifiche al codice):
   ```bash
   # Copia i file modificati
   scp -r modified-files root@192.168.1.100:/nas/molino/app/
   
   # Riavvia
   ssh root@192.168.1.100 "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml restart molino-app"
   ```

3. **Update Dipendenze** (package.json):
   ```bash
   # Ricopia l'intero progetto
   scp -r c:\Users\manue\Molino_briganti_task_manager\task-manager-app\* root@192.168.1.100:/nas/molino/app/
   
   # Rebuild
   .\deploy-nas-with-build.ps1 -NasIp 192.168.1.100
   ```
