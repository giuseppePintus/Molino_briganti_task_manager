# Deploy Image Docker al NAS - Guida Rapida

## Situazione
- ❌ Il NAS **NON ha il Dockerfile** e non può buildare localmente
- ❌ Il NAS cerca di fare **pull da Docker Hub** (fallisce)
- ✅ Abbiamo l'immagine costruita **localmente su Windows**
- ✅ Soluzione: **Esportare + Caricare** l'immagine

---

## Prerequisiti NAS

Prima di eseguire lo script, assicurati che sul NAS:

1. **Directory `/data/molino` esista** con permessi corretti:
```bash
# SSH al NAS
ssh root@<NAS_IP>

# Crea le directory
mkdir -p /nas/molino/app
mkdir -p /data/molino/backups
chmod -R 755 /data/molino
```

2. **I file del progetto siano copiati** a `/nas/molino/app`:
```bash
# Dal tuo computer Windows
scp -r c:\Users\manue\Molino_briganti_task_manager\task-manager-app\* root@<NAS_IP>:/nas/molino/app
```

---

## Opzione 1: Script Automatico (CONSIGLIATO)

Usa lo script PowerShell che **esporta + carica + avvia** tutto automaticamente.

### Esecuzione
```powershell
cd c:\Users\manue\Molino_briganti_task_manager\task-manager-app

# Con SSH key (nessuna password richiesta)
.\deploy-image-to-nas.ps1 -NasIp 192.168.1.100

# Con password
.\deploy-image-to-nas.ps1 -NasIp 192.168.1.100 -NasUser root -NasPassword tua_password
```

### Cosa fa
1. ✅ Verifica che l'immagine `molino-task-manager:latest` esista localmente
2. ✅ Esporta l'immagine in `molino-task-manager-latest.tar` (~100-150 MB)
3. ✅ Carica il tar sul NAS via SCP
4. ✅ Carica l'immagine nel Docker del NAS
5. ✅ Avvia i container con `docker-compose -f docker-compose.nas.yml up -d`
6. ✅ Verifica lo stato e fa health check
7. ✅ Pulisce il file tar locale

### Output atteso
```
🚀 Deploy Docker Image to NAS
==========================================
📦 Step 1: Verificando immagine locale...
✅ Immagine trovata: molino-task-manager latest
💾 Step 2: Esportando immagine in tar...
   Salvando a: c:\...\molino-task-manager-latest.tar
✅ Immagine esportata: 145.32 MB
📤 Step 3: Caricando immagine sul NAS (192.168.1.100)...
✅ File caricato sul NAS: /tmp/molino-task-manager-latest.tar
🐳 Step 4: Caricando immagine in Docker sul NAS...
✅ Immagine caricata con successo nel Docker del NAS
🚀 Step 5: Avviando container sul NAS...
✅ Container avviati con successo
📊 Step 6: Verificando stato dei container...
  NAME                         STATUS
  molino-briganti-task-manager Up (healthy)
  molino-nas-backup-server     Up
🏥 Step 7: Health check API...
✅ Health check OK: {"status":"ok"}
==========================================
✅ Deploy completato con successo!

📍 Accedi all'applicazione:
   URL: http://192.168.1.100:5000
   Login: Manuel / 123
```

---

## Opzione 2: Manuale (per troubleshooting)

Se lo script fallisce, fai i passaggi manualmente:

### Passo 1: Esporta l'immagine localmente
```powershell
cd c:\Users\manue\Molino_briganti_task_manager\task-manager-app
docker save molino-task-manager:latest -o molino-task-manager-latest.tar
```

### Passo 2: Carica sul NAS
```powershell
scp molino-task-manager-latest.tar root@192.168.1.100:/tmp/
```

### Passo 3: Carica in Docker sul NAS
```bash
# SSH al NAS
ssh root@192.168.1.100

# Carica l'immagine
docker load -i /tmp/molino-task-manager-latest.tar

# Elimina il tar
rm /tmp/molino-task-manager-latest.tar

# Verifica che l'immagine sia stata caricata
docker images | grep molino-task-manager
```

### Passo 4: Avvia i container
```bash
# NAS
cd /nas/molino/app

# Ferma vecchi container (se ci sono)
docker-compose -f docker-compose.nas.yml down

# Avvia con la nuova immagine
docker-compose -f docker-compose.nas.yml up -d

# Verifica lo stato
docker-compose -f docker-compose.nas.yml ps

# Vedi i log
docker-compose -f docker-compose.nas.yml logs -f
```

---

## Verifica Finale

Dopo il deploy, verifica che tutto funzioni:

### 1. Health Check API
```bash
curl http://192.168.1.100:5000/api/health
# Atteso: {"status":"ok"}
```

### 2. Accedi alla Web UI
```
http://192.168.1.100:5000
Login: Manuel / 123
```

### 3. Verifica Backup API
```bash
curl http://192.168.1.100:5001/api/backup/status
# Atteso: {"success":true,"backupsCount":...}
```

### 4. Test Persistence
```bash
# Dal NAS, verifica che i backup siano persistenti
docker exec molino-nas-backup-server ls -la /data/molino/backups/

# Ferma e riavvia i container
docker-compose -f docker-compose.nas.yml down
docker-compose -f docker-compose.nas.yml up -d

# Verifica che i backup siano ANCORA presenti
docker exec molino-nas-backup-server ls -la /data/molino/backups/
```

---

## Troubleshooting

### Errore: "docker save" fallisce
**Soluzione**: Ricostruisci l'immagine localmente
```powershell
cd c:\Users\manue\Molino_briganti_task_manager\task-manager-app
docker-compose build --no-cache
```

### Errore: "File transfer denied" o "permission denied"
**Soluzione**: Verifica permessi SSH sul NAS
```bash
# SSH al NAS come root
ssh root@192.168.1.100

# Assicurati che /tmp sia scrivibile
ls -la /tmp/

# Se problemi, copia in home directory
# Modifica lo script: /tmp → /root
```

### Container non si avvia dopo caricamento
**Soluzione**: Verifica i log sul NAS
```bash
ssh root@192.168.1.100
cd /nas/molino/app
docker-compose -f docker-compose.nas.yml logs molino-app
```

### Errore: "Database locked"
**Soluzione**: I backups interferiscono con il database. Ricrea da zero:
```bash
# NAS
ssh root@192.168.1.100
rm /data/molino/tasks.db
docker-compose -f docker-compose.nas.yml restart molino-app
```

---

## Note Importanti

1. **File tar è grande (~150 MB)**: Il trasferimento può richiedere 5-10 minuti su connessioni lente
2. **SSH key è consigliato**: Evita di mettere password in chiaro nei comandi
3. **Immagine locale rimane**: `docker images` sul tuo Windows avrà ancora l'immagine
4. **Backup persistono**: I backup in `/data/molino/backups` rimangono anche dopo restart container
