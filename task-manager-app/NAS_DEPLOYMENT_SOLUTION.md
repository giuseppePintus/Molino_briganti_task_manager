# 🎯 Soluzione Deploy NAS - Molino Task Manager

## 📌 Problema Risolto

**Errore**: `Failed to pull image "docker.io/library/molino-task-manager:latest"`

**Causa**: Il file `docker-compose.yml` stava cercando di fare pull da Docker Hub, ma l'immagine esiste solo localmente.

**Soluzione**: Configurazione Build locale con `build:` nel docker-compose per il NAS.

---

## 📦 File di Deployment Creati

### 1. `docker-compose.nas.yml` ⭐
Configurazione docker-compose ottimizzata per NAS con:
- **Build locale** (non pull da Hub)
- **Bind mount persistente**: `/data/molino:/data/molino:rw`
- **Entrambi i servizi**: App principale + Backup server
- **Health checks** per monitoring

### 2. `deploy-nas.ps1`
Script PowerShell automatico che:
1. Crea le directory sul NAS
2. Copia il progetto via SCP
3. Build locale
4. Avvia i container
5. Testa le API

**Uso**:
```powershell
.\deploy-nas.ps1 -NasIP 192.168.1.100 -NasUser root -NasPassword password
```

### 3. `DEPLOY_NAS.md`
Guida completa per deploy manuale con troubleshooting.

### 4. `ERROR_PULL_IMAGE.md`
Documentazione dettagliata dell'errore e 2 opzioni di soluzione.

### 5. `DEPLOYMENT_FILES.md`
Riepilogo di tutti i file e loro utilizzo.

---

## 🚀 Procedura di Deploy Rapida

### Con Script Automatico (CONSIGLIATO)
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app
.\deploy-nas.ps1 -NasIP 192.168.1.100 -NasUser root -NasPassword yourpassword
```
Tempo: ~10 minuti

### Manuale (SSH)
```bash
# 1. SSH al NAS
ssh root@192.168.1.100

# 2. Crea directory
mkdir -p /nas/molino/app /data/molino/backups && chmod -R 755 /data/molino

# 3. Copia file (da altro terminale)
scp -r C:\Users\manue\Molino_briganti_task_manager\task-manager-app\* root@192.168.1.100:/nas/molino/app/

# 4. Avvia
ssh root@192.168.1.100
cd /nas/molino/app
docker-compose -f docker-compose.nas.yml up -d --build

# 5. Verifica
docker-compose -f docker-compose.nas.yml ps
curl http://localhost:5000/api/health
```

---

## ✅ Verifiche Post-Deploy

```bash
# Container status
docker-compose -f docker-compose.nas.yml ps

# Health check
curl http://localhost:5000/api/health
# Atteso: {"status":"ok"}

# Backup API
curl http://localhost:5001/api/backup/status

# Web UI
# Browser: http://<NAS_IP>:5000
# Username: Manuel
# Password: 123
```

---

## 🔄 Test Persistenza Dati

```bash
# 1. Verifica backup attuali
docker exec molino-nas-backup-server ls -la /data/molino/backups/

# 2. Ferma container
docker-compose -f docker-compose.nas.yml down

# 3. Riavvia
docker-compose -f docker-compose.nas.yml up -d

# 4. Verifica che i backup siano ancora lì
docker exec molino-nas-backup-server ls -la /data/molino/backups/
# I file devono essere gli stessi!
```

---

## 🔧 Modifiche Implementate

### Docker Build Context Corretto
**Problema**: Dockerfile usava path `task-manager-app/` come se il contesto fosse il parent directory.

**Soluzione**: Corretto il contesto e i path nel Dockerfile:
- `COPY package*.json ./` (non `COPY task-manager-app/package*.json ./`)
- `COPY . .` (non `COPY task-manager-app/ .`)
- `COPY .env.docker ./server/.env` (non `COPY task-manager-app/.env.docker ...`)

### docker-compose.yml Corretto
```yaml
services:
  molino-app:
    build:
      context: .              # ✅ Directory corrente
      dockerfile: Dockerfile  # ✅ File nel directory corrente
      args:
        - NODE_ENV=production
    image: molino-task-manager:latest
    # ... resto della configurazione
```

### docker-compose.nas.yml Creato
Identico a `docker-compose.yml` ma esplicitamente per il NAS per evitare confusione con il vecchio file che cercava di fare pull.

---

## 📊 Configurazione Finale

### Localhost (Windows)
```
Porta: 5000
Immagine: molino-task-manager:latest (build locale)
Database: /data/molino/tasks.db (C:\data\molino su Windows)
Backup: /data/molino/backups
Comando: docker-compose up -d --build
```

### NAS (Linux)
```
Porta: 5000 (forwarded da 5001)
Immagine: molino-task-manager:latest (build locale)
Database: /data/molino/tasks.db (persistente su NAS)
Backup: /data/molino/backups (persistente su NAS)
Comando: docker-compose -f docker-compose.nas.yml up -d --build
```

---

## 🎯 Checklist Deploy Finale

**Prima:**
- [ ] IP NAS confermato
- [ ] SSH funzionante
- [ ] Spazio libero su NAS

**Durante:**
- [ ] Script/comandi eseguiti
- [ ] Build completato
- [ ] Container in "Up"

**Dopo:**
- [ ] Health check OK
- [ ] Web UI accessibile
- [ ] Login funzionante
- [ ] Backup creabili
- [ ] Persistenza verificata (restart test)

---

## 🌐 Accesso Web UI

**URL**: `http://<NAS_IP>:5000`

**Credenziali**:
- Username: **Manuel**
- Password: **123**

**Moduli disponibili**:
- Dashboard
- Admin (settings, operators, backup)
- Orders Planner
- Carousel operatori

---

## 📞 Troubleshooting Rapido

| Errore | Soluzione |
|--------|-----------|
| "pull access denied" | Usa `docker-compose.nas.yml` |
| "Dockerfile not found" | Verifica che sia copiato con `ls -la /nas/molino/app/Dockerfile` |
| "Health check fails" | Attendi 30 sec, poi retry. Vedi log con `docker-compose logs -f` |
| "Build non inizia" | Verifica spazio disco: `df -h` |
| "Permission denied" | Assicura che `/data/molino` abbia permessi 755 |

---

## 📚 File di Riferimento

- **docker-compose.nas.yml** - Config NAS ⭐
- **deploy-nas.ps1** - Script automatico
- **DEPLOY_NAS.md** - Guida manuale completa
- **ERROR_PULL_IMAGE.md** - Troubleshooting errore pull
- **DEPLOYMENT_FILES.md** - Riepilogo tutti i file

---

## ✨ Status Finale

✅ **Build locale configurato**
✅ **Docker-compose NAS creato**
✅ **Script deploy automatico pronto**
✅ **Persistenza dati garantita**
✅ **Documentazione completa**

**Pronto per il deploy su NAS!**

---

**Creato**: 26 Novembre 2025
**Versione**: 1.0 (Stable)
