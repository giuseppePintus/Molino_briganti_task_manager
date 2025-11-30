Copia-incolla l'errore esatto# Molino Task Manager - Deploy su NAS

## ⚠️ IMPORTANTE: Il NAS DEVE fare il BUILD locale, non il PULL

Il problema: Docker sul NAS sta cercando di fare pull dell'immagine da Docker Hub, ma l'immagine non esiste pubblicamente.

**SOLUZIONE**: Usare il file `docker-compose.nas.yml` che FORZA il build locale.

---

## Procedura di Deploy su NAS

### 1. Preparazione della directory NAS
```bash
# SSH al NAS come root
ssh root@<NAS_IP>

# Crea la struttura di directory
mkdir -p /nas/molino/app
mkdir -p /data/molino/backups
mkdir -p /data/molino

# Dai i permessi giusti
chmod -R 755 /data/molino
```

### 2. Copia tutti i file del progetto al NAS
```bash
# Dal tuo computer locale, copia il progetto
scp -r c:\Users\manue\Molino_briganti_task_manager\task-manager-app root@<NAS_IP>:/nas/molino/app

# Verifica che sia copiato correttamente
ssh root@<NAS_IP> "ls -la /nas/molino/app"
```

### 3. Deploy con docker-compose (BUILD locale)
```bash
# SSH al NAS
ssh root@<NAS_IP>

# Naviga alla directory app
cd /nas/molino/app

# IMPORTANTE: Usa docker-compose.nas.yml che fa il BUILD
# NON usare docker-compose.yml
docker-compose -f docker-compose.nas.yml down

# Build e avvia
docker-compose -f docker-compose.nas.yml up -d --build

# Verifica lo stato
docker-compose -f docker-compose.nas.yml ps

# Vedi i log
docker-compose -f docker-compose.nas.yml logs -f
```

### 4. Verifica il Deploy
```bash
# Health check
curl http://localhost:5000/api/health

# Backup status
curl http://localhost:5001/api/backup/status

# Accedi web UI
# Apri browser: http://<NAS_IP>:5000
```

### 5. Test Backup Persistence
```bash
# Crea un backup manuale dall'UI
# Admin → Backup → "Crea Backup Manuale"

# Verifica che il file sia persistente
docker exec molino-nas-backup-server ls -la /data/molino/backups/

# Ferma i container
docker-compose -f docker-compose.nas.yml down

# Riavvia
docker-compose -f docker-compose.nas.yml up -d

# Verifica che i backup siano ancora lì
docker exec molino-nas-backup-server ls -la /data/molino/backups/
```

---

## 📋 Differenze tra i file docker-compose

### docker-compose.yml (LOCALHOST - Windows)
- Build context: `.` (current directory di Windows)
- Dockerfile path: `Dockerfile`
- Bind mount: `/data/molino:/data/molino:rw` (mappa a C:\data\molino su Windows)

### docker-compose.nas.yml (NAS - Linux)
- Build context: `.` (current directory del NAS)
- Dockerfile path: `Dockerfile` (stesso file, funziona su entrambe le piattaforme)
- Bind mount: `/data/molino:/data/molino:rw` (mappa a /data/molino sul NAS)

**Nota**: Entrambi usano `build:` quindi **NON** faranno pull da Docker Hub. Faranno il build locale.

---

## 🔍 Troubleshooting

### Errore: "pull access denied for molino-task-manager"
**Soluzione**: Usa `docker-compose.nas.yml` che ha `build:` configurato per il build locale.

### Errore: "Dockerfile not found"
**Verifica**:
```bash
# Assicurati che il Dockerfile sia nel /nas/molino/app
ls -la /nas/molino/app/Dockerfile

# Se manca, ricopia i file
scp -r c:\Users\manue\Molino_briganti_task_manager\task-manager-app/* root@<NAS_IP>:/nas/molino/app
```

### Build è molto lento la prima volta
**Normale**: Primo build richiede 5-10 minuti per:
1. Scaricare base image (node:18)
2. Installare npm packages
3. Compilare TypeScript
4. Creare l'immagine finale

I build successivi saranno più veloci (cache layer).

### Container non si avvia / Health check fallisce
```bash
# Vedi i log
docker-compose -f docker-compose.nas.yml logs molino-app

# Riavvia manualmente
docker-compose -f docker-compose.nas.yml restart molino-app

# Forza recreate
docker-compose -f docker-compose.nas.yml down
docker-compose -f docker-compose.nas.yml up -d --build
```

---

## 📦 Variabili d'Ambiente

Se hai bisogno di customizzare JWT_SECRET o altre variabili, crea un file `.env` sul NAS:

```bash
# SSH al NAS
ssh root@<NAS_IP>

# Crea .env
cat > /nas/molino/app/.env << EOF
JWT_SECRET=your-custom-secret-key-here
NAS_URL=localhost
NAS_PORT=5001
EOF

# Ricrea i container
docker-compose -f docker-compose.nas.yml up -d --build
```

---

## 🎯 Checklist Deploy

- [ ] Directory `/data/molino` creata e con permessi 755
- [ ] File del progetto copiati a `/nas/molino/app`
- [ ] `docker-compose.nas.yml` presente in `/nas/molino/app`
- [ ] Build completato con `docker-compose -f docker-compose.nas.yml up -d --build`
- [ ] Entrambi i container in stato "Up"
- [ ] Health check: `curl http://localhost:5000/api/health` → `{"status":"ok"}`
- [ ] Web UI accessibile: `http://<NAS_IP>:5000`
- [ ] Login funzionante (Manuel/123)
- [ ] Backup API funzionante: `http://<NAS_IP>:5001/api/backup/status`
- [ ] Test persistence: backup creato, container restart, backup ancora presente
