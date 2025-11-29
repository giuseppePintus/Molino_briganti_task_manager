# 📦 File di Deploy - Molino Task Manager per NAS

## 🎯 Obiettivo
Risolvere l'errore "Failed to pull image" e fare il deploy completo del Molino Task Manager su NAS con persistenza dati garantita.

---

## 📄 File di Configuration

### 1. **docker-compose.nas.yml** ⭐ PRINCIPALE
**Uso**: Configurazione docker-compose per NAS
**Contiene**: 
- `build:` configurato per il BUILD LOCALE (non pull)
- Bind mount `/data/molino:/data/molino:rw` per persistenza
- Entrambi i servizi: app principale + NAS backup server
- Health checks configurati

**Comando**:
```bash
docker-compose -f docker-compose.nas.yml up -d --build
```

---

### 2. **deploy-nas.ps1** 
**Uso**: Script PowerShell automatico per il deploy
**Contiene**:
- Copia dei file dal PC locale al NAS via SCP
- Creazione automatica delle directory
- Esecuzione del build
- Test API per verificare il deploy

**Comando**:
```powershell
.\deploy-nas.ps1 -NasIP 192.168.1.100 -NasUser root -NasPassword yourpassword
```

**Cosa fa**:
1. ✅ Crea directory su NAS
2. ✅ Copia tutto il progetto
3. ✅ Build locale
4. ✅ Avvia container
5. ✅ Test della comunicazione

---

### 3. **DEPLOY_NAS.md**
**Uso**: Guida manuale e completa per il deploy
**Contiene**:
- Procedura step-by-step
- Comandi per SSH manuale
- Test di persistenza dati
- Troubleshooting

---

### 4. **ERROR_PULL_IMAGE.md** 
**Uso**: Soluzione all'errore "Failed to pull image"
**Contiene**:
- Causa dell'errore
- 2 opzioni di soluzione
- Differenze tra i file docker-compose
- Troubleshooting specifico

---

## 🚀 Procedura di Deploy Consigliata

### Opzione A: Deploy Automatico (Consigliato)
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app
.\deploy-nas.ps1 -NasIP 192.168.1.100 -NasUser root -NasPassword yourpassword
```
Tempo: 5-10 minuti (dipende da velocità rete e NAS)

### Opzione B: Deploy Manuale
```bash
# 1. SSH al NAS
ssh root@192.168.1.100

# 2. Crea directory
mkdir -p /nas/molino/app /data/molino/backups
chmod -R 755 /data/molino

# 3. Copia file (da altro terminale):
scp -r C:\Users\manue\Molino_briganti_task_manager\task-manager-app\* root@192.168.1.100:/nas/molino/app/

# 4. Build e avvia
ssh root@192.168.1.100
cd /nas/molino/app
docker-compose -f docker-compose.nas.yml up -d --build

# 5. Verifica
docker-compose -f docker-compose.nas.yml ps
curl http://localhost:5000/api/health
```

---

## ⚠️ ERRORI COMUNI

### ❌ "Failed to pull image docker.io/library/molino-task-manager"
**Causa**: Stai usando `docker-compose.yml` invece di `docker-compose.nas.yml`

**Soluzione**:
```bash
# ❌ SBAGLIATO
docker-compose up -d --build

# ✅ CORRETTO
docker-compose -f docker-compose.nas.yml up -d --build
```

### ❌ "Dockerfile not found"
**Causa**: Il Dockerfile non è stato copiato al NAS

**Soluzione**: Usa lo script di deploy che copia automaticamente, o verifica:
```bash
ssh root@192.168.1.100 "ls -la /nas/molino/app/Dockerfile"
```

### ❌ Build non inizia / Rimane in sospeso
**Causa**: Build molto grande la prima volta

**Verifica**: Guarda i log:
```bash
ssh root@192.168.1.100
cd /nas/molino/app
docker-compose -f docker-compose.nas.yml logs -f
```

---

## ✅ Verifiche Post-Deploy

```bash
# 1. Container status
docker-compose -f docker-compose.nas.yml ps

# 2. Health check
curl http://localhost:5000/api/health
# Atteso: {"status":"ok"}

# 3. Backup API
curl http://localhost:5001/api/backup/status
# Atteso: {"success":true,"backupsCount":...}

# 4. File di backup creati
ls -la /data/molino/backups/

# 5. Login web
# Apri browser: http://192.168.1.100:5000
# Username: Manuel
# Password: 123
```

---

## 🔄 Test di Persistenza Dati

**Verifica che i backup restino dopo restart**:

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

## 📊 Architettura Deploy

```
Windows (Local)
└── Task Manager App Source
    ├── Dockerfile (build instructions)
    ├── docker-compose.nas.yml (config for NAS)
    ├── deploy-nas.ps1 (automation script)
    └── All project files
    
    ↓ scp copy
    
NAS Server (Linux)
└── /nas/molino/app/
    ├── All source files
    ├── docker-compose.nas.yml
    └── Dockerfile
    
    ↓ docker build
    
Docker Local Image
└── molino-task-manager:latest
    
    ↓ docker-compose up
    
Running Containers
├── molino-briganti-task-manager (port 5000)
└── molino-nas-backup-server (port 5001)
    
    ↓ bind mount
    
Persistent Data
└── /data/molino/
    ├── tasks.db (database)
    └── backups/
        ├── db-backup-*.sql
        └── ...
```

---

## 📝 File Correlati Esistenti

- **docker-compose.yml** - Versione locale (Windows localhost)
- **Dockerfile** - Build instructions (identico per tutti i platform)
- **DOCKER_BUILD_GUIDE.md** - Guida generale Docker
- **README_PROGETTO.md** - Documentazione generale progetto

---

## 🎯 Checklist Finale

**Prima del deploy:**
- [ ] IP NAS confermato e raggiungibile
- [ ] Credenziali SSH funzionanti
- [ ] Spazio libero su NAS (almeno 2GB)
- [ ] Docker/Docker Compose installato su NAS

**Durante il deploy:**
- [ ] Script/comandi eseguiti senza errori
- [ ] Build completato con successo
- [ ] Container in stato "Up"

**Dopo il deploy:**
- [ ] Health check: `{"status":"ok"}`
- [ ] Login funzionante
- [ ] Web UI accessibile
- [ ] Backup API funzionante
- [ ] File di backup presenti in `/data/molino/backups/`
- [ ] Test persistence: restart container, backup ancora presenti

---

## 💡 Prossimi Passi

1. ✅ Esegui il deploy con lo script `deploy-nas.ps1`
2. ✅ Verifica il funzionamento completo
3. ✅ Testa la creazione manuale di backup
4. ✅ Verifica la persistenza dopo restart
5. ✅ Accedi alla web UI e crea un ordine di test

---

## 📞 Supporto

Se hai problemi:

1. **Errore di pull**: Leggi `ERROR_PULL_IMAGE.md`
2. **Deploy manuale**: Leggi `DEPLOY_NAS.md`
3. **Log container**: 
   ```bash
   docker-compose -f docker-compose.nas.yml logs -f
   ```
4. **SSH/SCP non funziona**: Verifica credenziali e IP
5. **Build non inizia**: Verifica spazio disco su NAS

---

**Status**: ✅ Pronto per il deploy
**Ultima versione**: 26 Novembre 2025
