# NAS Deployment Guide - Molino Briganti Task Manager

## 🎯 Soluzione: Docker Hub

Poiché il Docker del NAS non può buildare immagini localmente, usiamo **Docker Hub**:

- ✅ Build su PC e push a Docker Hub
- ✅ NAS pulla l'immagine precompilata
- ✅ Volume mounts Docker per dati persistenti
- ✅ Autostart e health checks
- ✅ Database e backups salvati permanentemente

---

## 📋 Prerequisites

- Docker installato sul NAS
- Accesso SSH al NAS
- Account Docker Hub (gratis su https://hub.docker.com)
- Docker Desktop su PC (per buildare)

---

## 🚀 Workflow Completo

### STEP 1: Build e Push su PC

Dal PC, nel progetto:

```bash
cd Molino_briganti_task_manager/task-manager-app

# Login Docker Hub
docker login

# Build immagine
docker build -f Dockerfile.hub -t TUO_USERNAME/molino-briganti:latest .

# Push su Docker Hub
docker push TUO_USERNAME/molino-briganti:latest
```

**Sostituisci `TUO_USERNAME` con il tuo username Docker Hub!**

### STEP 2: Setup sul NAS

Via SSH al NAS:

```bash
# Scarica script
cd /tmp
wget https://raw.githubusercontent.com/giuseppePintus/Molino_briganti_task_manager/main/task-manager-app/deploy-nas.sh
chmod +x deploy-nas.sh

# Esegui setup (usa la tua immagine Docker Hub)
DOCKER_HUB_IMAGE=TUO_USERNAME/molino-briganti:latest ./deploy-nas.sh setup
```

Fatto! Il container sarà in esecuzione con dati persistenti.

---

## 📂 Percorsi Permanenti

I dati rimangono salvati in:

# Primo setup (crea directory, clona repo, builda, avvia)
./deploy-nas.sh setup
```

**Cosa fa:**
1. Crea `/mnt/nas/molino-app/` con subdirectory `data/` e `backups/`
2. Clona il repository
3. Builda l'immagine Docker localmente
4. Avvia il container con volumi persistenti
5. Mostra status e log

---

## 📂 Percorsi Permanenti

Dopo il setup, i dati saranno in:

```
/mnt/nas/molino-app/
├── data/
│   └── prisma.db              # Database persistente ✨
├── backups/
│   └── *.db                   # Backup automatici
```

---

## 🎮 Comandi Disponibili

### Gestione Container

```bash
# Avvia (dopo primo setup)
./deploy-nas.sh start

# Ferma
./deploy-nas.sh stop

# Riavvia
./deploy-nas.sh restart

# Stato
./deploy-nas.sh status

# Log in tempo reale
./deploy-nas.sh logs
```

### Gestione Backup

```bash
# Crea backup manuale
./deploy-nas.sh backup

# Elenca backup
./deploy-nas.sh list

# Ripristina backup specifico
./deploy-nas.sh restore backup-2024-11-22-120000.db

# Ripristina ultimo backup dal NAS
./deploy-nas.sh restore-latest
```

---

## 🔄 Se NAS Riavvia

Dopo riavvio, il container ripartirà automaticamente grazie a `--restart unless-stopped`.

Verifica status:

```bash
./deploy-nas.sh status
```

---

## 📊 Status della Documentazione

```
/mnt/nas/molino-app/
├── data/
│   └── prisma.db              # Database persistente
├── backups/
│   └── *.db                   # Backup automatici
```

---

## 🌐 Accesso Web

Dopo il deploy:

```
URL: http://<nas-ip>:5000
API: http://<nas-ip>:5000/api
Backup: http://<nas-ip>:5000/api/backup
```

Sostituisci `<nas-ip>` con l'IP del NAS.

---

## 📝 Note Importanti

1. **Database SQLite**: Salvato in `/mnt/nas/molino-app/data/prisma.db`
2. **Auto-backup**: Configurato ogni 60 minuti
3. **Restart policy**: Il container riparte automaticamente se crasha
4. **Health checks**: Ogni 30 secondi
5. **Immagine da Docker Hub**: Aggiorna con `docker pull` e `docker restart`

---

## 🔧 Update Futuri

Se modifichi il codice e vuoi aggiornare:

```bash
# PC:
docker build -f Dockerfile.hub -t TUO_USERNAME/molino-briganti:latest .
docker push TUO_USERNAME/molino-briganti:latest

# NAS:
docker pull TUO_USERNAME/molino-briganti:latest
docker restart molino-briganti-app
```

---

## 🐛 Troubleshooting Avanzato

### Immagine non trovata su Docker Hub

```bash
# Verifica che l'immagine esista
docker pull TUO_USERNAME/molino-briganti:latest

# Se non esiste, buildala sul PC
docker build -f Dockerfile.hub -t TUO_USERNAME/molino-briganti:latest .
docker push TUO_USERNAME/molino-briganti:latest
```

### Cambiare immagine Docker Hub

```bash
# Usa una diversa immagine
DOCKER_HUB_IMAGE=autre-username/autre-image:tag ./deploy-nas.sh setup
```

---

## 📞 Link Utili

- 📖 [DOCKER_HUB_COMPLETE_WORKFLOW.md](./06-DOCKER_HUB_COMPLETE_WORKFLOW.md) - Workflow completo
- 🐳 [PERSISTENT_STORAGE.md](./02-PERSISTENT_STORAGE.md) - Storage persistente
- 🔐 [../07-maintenance/01-BACKUP_SYSTEM.md](../07-maintenance/01-BACKUP_SYSTEM.md) - Backup system

---

**Script versione:** 3.0 (Docker Hub)  
**Data:** 22 Novembre 2024
