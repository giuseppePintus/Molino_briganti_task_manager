# Docker Hub Deployment - Complete Workflow

Per deployare su NAS senza Dockerfile locale, usiamo Docker Hub.

---

## 📋 Prerequisiti

- Docker Desktop installato (sul PC)
- Account Docker Hub (free: https://hub.docker.com)
- Accesso SSH al NAS

---

## STEP 1: Login Docker su PC

```bash
# Effettua login
docker login

# Inserisci username e password Docker Hub
```

---

## STEP 2: Build Immagine su PC

Dal PC, nella directory del progetto:

```bash
cd Molino_briganti_task_manager/task-manager-app

# Build con tag Docker Hub
docker build -f Dockerfile.hub -t TUO_USERNAME/molino-briganti:latest .

# Verifica che sia buildata
docker images | grep molino-briganti
```

**Sostituisci `TUO_USERNAME` con il tuo username Docker Hub!**

---

## STEP 3: Push su Docker Hub

```bash
# Push immagine
docker push TUO_USERNAME/molino-briganti:latest

# Verifica su https://hub.docker.com/repositories
```

La prima volta può impiegare 5-10 minuti.

---

## STEP 4: Sul NAS - Prepara Directory

Via SSH al NAS:

```bash
# Crea directory permanenti
mkdir -p /mnt/nas/molino-app/data
mkdir -p /mnt/nas/molino-app/backups
chmod 777 /mnt/nas/molino-app/data
chmod 777 /mnt/nas/molino-app/backups
```

---

## STEP 5: Sul NAS - Esegui Container

Via SSH al NAS:

```bash
# Pull e esegui immagine da Docker Hub
docker run -d \
  --name molino-briganti-app \
  -p 5000:5000 \
  -v /mnt/nas/molino-app/data:/app/data \
  -v /mnt/nas/molino-app/backups:/app/backups \
  -e DATABASE_URL="file:/app/data/prisma.db" \
  -e BACKUP_DIR="/app/backups" \
  -e NODE_ENV="production" \
  --restart unless-stopped \
  TUO_USERNAME/molino-briganti:latest
```

**Sostituisci `TUO_USERNAME`!**

---

## ✅ Verifica sul NAS

```bash
# Vedi log
docker logs molino-briganti-app

# Vedi status
docker ps | grep molino-briganti-app

# Verifica DB
ls -la /mnt/nas/molino-app/data/
```

---

## 🔄 Update Futuri

Se modifichi il codice:

```bash
# PC:
docker build -f Dockerfile.hub -t TUO_USERNAME/molino-briganti:latest .
docker push TUO_USERNAME/molino-briganti:latest

# NAS:
docker pull TUO_USERNAME/molino-briganti:latest
docker stop molino-briganti-app
docker rm molino-briganti-app
docker run -d ... (stesso comando di prima)
```

---

## 🎯 URL Accesso

```
http://<nas-ip>:5000
```

Sostituisci `<nas-ip>` con l'IP del NAS.

---

## 📝 Note Importanti

- ✅ Database salvato in `/mnt/nas/molino-app/data/` (PERSISTENTE)
- ✅ Backups salvati in `/mnt/nas/molino-app/backups/` (PERSISTENTE)
- ✅ Container rimane attivo con `--restart unless-stopped`
- ✅ Immagine pullata da Docker Hub ogni volta che cambia

---

**Credenziali Docker Hub:**
```
https://hub.docker.com/settings/security
```

Genera un Personal Access Token se preferisci non usare la password.
