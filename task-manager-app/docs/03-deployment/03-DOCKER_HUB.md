# Istruzioni per Deploy su Docker Hub e NAS

## STEP 1: Build e Push su Docker Hub (esegui da PC)

```bash
cd Molino_briganti_task_manager/task-manager-app

# Effettua login su Docker Hub
docker login

# Build l'immagine
docker build -f Dockerfile.hub -t tuoUsername/molino-briganti-app:latest .

# Push su Docker Hub
docker push tuoUsername/molino-briganti-app:latest
```

Sostituisci `tuoUsername` con il tuo username Docker Hub.

---

## STEP 2: Crea directory permanente sul NAS

Se il NAS ha un filesystem montato (es. `/mnt/nas` o `/volume1`), crea:

```bash
# Sul NAS via SSH
mkdir -p /mnt/nas/molino-app/data
mkdir -p /mnt/nas/molino-app/backups
chmod 777 /mnt/nas/molino-app/data
chmod 777 /mnt/nas/molino-app/backups
```

---

## STEP 3: Esegui container sul NAS

Sostituisci `your-nas-path` con il path reale del NAS:

```bash
docker run -d \
  --name molino-app \
  -p 5000:5000 \
  -v /your-nas-path/molino-app/data:/app/data \
  -v /your-nas-path/molino-app/backups:/app/backups \
  -e DATABASE_URL="file:/app/data/prisma.db" \
  -e BACKUP_DIR="/app/backups" \
  --restart unless-stopped \
  tuoUsername/molino-briganti-app:latest
```

---

## STEP 4: Verifica

```bash
# Controlla i log
docker logs molino-app

# Verifica le directory persistenti
ls -la /your-nas-path/molino-app/data
ls -la /your-nas-path/molino-app/backups
```

---

## Alternativa: Se il NAS non può montare directory esterne

Se il NAS permette solo container isolati senza volume mounts, allora i dati saranno persi al riavvio. In questo caso:

1. Imposta backup automatici verso un server esterno
2. Usa cron job per salvare i backup periodicamente
3. O configura il NAS per usare volumi named di Docker (meno ideale ma possibile)

```bash
# Con Docker named volume (non ideale ma funziona)
docker volume create molino-data
docker volume create molino-backups

docker run -d \
  --name molino-app \
  -p 5000:5000 \
  -v molino-data:/app/data \
  -v molino-backups:/app/backups \
  --restart unless-stopped \
  tuoUsername/molino-briganti-app:latest
```
