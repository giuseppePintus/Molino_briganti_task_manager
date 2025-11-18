# 📦 Sistema di Backup Automatico - Documentazione

## 🎯 Panoramica

Sistema di backup automatico e ripristino per **Molino Briganti Task Manager** con:
- ✅ Backup automatico ad ogni operazione database
- ✅ Backup periodico orario
- ✅ Integrazione NAS per storage distribuito
- ✅ Docker containerizzazione
- ✅ Ripristino automatico all'avvio
- ✅ API REST per gestione backup
- ✅ Health check e monitoraggio

---

## 📋 Architettura

### Componenti

```
┌─────────────────────────────────────────────────────────┐
│                   Docker Compose                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │   molino-app (Node.js + Express)                │  │
│  │   ├─ Server: port 5000                          │  │
│  │   ├─ Database: SQLite                           │  │
│  │   └─ Backup Service (Automatic)                 │  │
│  └─────────────────────┬──────────────────────────┘  │
│                        │                              │
│  ┌─────────────────────▼──────────────────────────┐  │
│  │   nas-server (NAS Locale)                      │  │
│  │   ├─ Port: 5001                                │  │
│  │   └─ Storage: volume backup_data               │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  Volumi:                                            │
│  ├─ backup_data: /app/backups                       │
│  └─ db_data: /app/server/prisma/data              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Flusso Backup

```
Database Operation (create/update/delete)
         ↓
    Prisma Middleware
         ↓
  BackupService.backupDatabase()
         ↓
    Copy SQLite DB
         ↓
    Upload to NAS
         ↓
    ✅ Backup Complete
```

---

## 🚀 Installazione e Avvio

### Prerequisiti

- Docker Desktop (Windows/Mac) o Docker + Docker Compose (Linux)
- Git
- PowerShell (Windows) o Bash (Linux/Mac)

### Quick Start

#### Linux/Mac:

```bash
git clone https://github.com/giuseppePintus/Molino_briganti_task_manager.git
cd Molino_briganti_task_manager/task-manager-app

# Avvia l'applicazione
chmod +x deploy-nas.sh
./deploy-nas.sh start

# Verifica stato
./deploy-nas.sh status
```

#### Windows (PowerShell):

```powershell
git clone https://github.com/giuseppePintus/Molino_briganti_task_manager.git
cd Molino_briganti_task_manager\task-manager-app

# Avvia l'applicazione
.\deploy-nas.ps1 -Action start

# Verifica stato
.\deploy-nas.ps1 -Action status
```

#### Manuale (Docker Compose):

```bash
docker-compose up -d
```

### Primo Avvio

Alla partenza:
1. ✅ Verifica connessione database
2. 🔄 Cerca backup dal NAS
3. 📦 Crea backup iniziale
4. ⏰ Attiva backup automatico orario

```
[Output Console]
Database connected successfully
🔄 Checking for backups on NAS...
ℹ️ No backups available on NAS (first run)
✅ Database backed up: ./backups/db-backup-2024-01-15-120000.sql
⏰ Auto backup scheduled every 60 minutes
Server is running on port 5000
Web UI: http://localhost:5000
Backup API: http://localhost:5000/api/backup
```

---

## 📚 API di Backup

### Base URL
```
http://localhost:5000/api/backup
```

### Endpoints

#### 1️⃣ Lista Backup
```http
GET /list
```
**Response:**
```json
{
  "success": true,
  "files": [
    "db-backup-2024-01-15-120000.sql",
    "db-backup-2024-01-15-110000.sql"
  ],
  "count": 2,
  "timestamp": "2024-01-15T12:05:00.000Z"
}
```

#### 2️⃣ Crea Backup Manuale
```http
POST /manual
```
**Response:**
```json
{
  "success": true,
  "message": "Backup created successfully",
  "path": "./backups/db-backup-2024-01-15-120500.sql",
  "timestamp": "2024-01-15T12:05:00.000Z"
}
```

#### 3️⃣ Scarica Backup
```http
GET /download/db-backup-2024-01-15-120000.sql
```
**Response:** File binario (SQLite database)

#### 4️⃣ Ripristina da Backup
```http
POST /restore/db-backup-2024-01-15-120000.sql
```
**Response:**
```json
{
  "success": true,
  "message": "Database restored successfully",
  "path": "./backups/db-backup-2024-01-15-120000.sql",
  "timestamp": "2024-01-15T12:05:00.000Z"
}
```

#### 5️⃣ Ripristina Ultimo Backup (NAS)
```http
POST /restore-latest
```
**Response:**
```json
{
  "success": true,
  "message": "Latest backup restored successfully",
  "timestamp": "2024-01-15T12:05:00.000Z"
}
```

#### 6️⃣ Elimina Backup
```http
DELETE /db-backup-2024-01-15-120000.sql
```

#### 7️⃣ Status Sistema
```http
GET /status
```
**Response:**
```json
{
  "success": true,
  "system": "Automated Backup System",
  "status": "running",
  "backupsCount": 2,
  "latestBackup": "db-backup-2024-01-15-120000.sql",
  "nasUrl": "192.168.1.100",
  "nasPort": "5000",
  "backupDir": "./backups",
  "timestamp": "2024-01-15T12:05:00.000Z"
}
```

---

## 🛠️ Script di Deployment

### Linux/Mac: `deploy-nas.sh`

```bash
# Avvia applicazione
./deploy-nas.sh start

# Arresta applicazione
./deploy-nas.sh stop

# Riavvia applicazione
./deploy-nas.sh restart

# Mostra stato
./deploy-nas.sh status

# Mostra log
./deploy-nas.sh logs

# Crea backup manuale
./deploy-nas.sh backup

# Elenca backup
./deploy-nas.sh list

# Ripristina specifico backup
./deploy-nas.sh restore db-backup-2024-01-15-120000.sql

# Ripristina ultimo backup
./deploy-nas.sh restore-latest
```

### Windows: `deploy-nas.ps1`

```powershell
# Avvia applicazione
.\deploy-nas.ps1 -Action start

# Arresta applicazione
.\deploy-nas.ps1 -Action stop

# Riavvia applicazione
.\deploy-nas.ps1 -Action restart

# Mostra stato
.\deploy-nas.ps1 -Action status

# Mostra log
.\deploy-nas.ps1 -Action logs

# Crea backup manuale
.\deploy-nas.ps1 -Action backup

# Elenca backup
.\deploy-nas.ps1 -Action list

# Ripristina specifico backup
.\deploy-nas.ps1 -Action restore -BackupFile db-backup-2024-01-15-120000.sql

# Ripristina ultimo backup
.\deploy-nas.ps1 -Action restore-latest
```

---

## ⚙️ Configurazione

### File `.env` (Local Development)

```dotenv
# Backup Configuration
BACKUP_DIR=./backups
NAS_URL=192.168.1.100
NAS_PORT=5000
NAS_PATH=/mnt/nas/backups
```

### File `.env.docker` (Production/Docker)

```dotenv
# NAS Configuration per Docker
NAS_URL=nas-server
NAS_PORT=5000
NAS_PATH=/mnt/nas/backups
```

### Docker Compose: `docker-compose.yml`

```yaml
services:
  molino-app:
    environment:
      - NAS_URL=nas-server
      - NAS_PORT=5000
      - BACKUP_DIR=/app/backups
    volumes:
      - backup_data:/app/backups
      - db_data:/app/server/prisma/data

  nas-server:
    # NAS locale per testing
    volumes:
      - backup_data:/backups
```

---

## 🔧 Configurazione NAS Reale

Per collegare un NAS reale (e.g., Synology, QNAP):

### 1. Modifica `docker-compose.yml`:

```yaml
volumes:
  nas_backup:
    driver: local
    driver_opts:
      type: nfs
      o: addr=192.168.1.100,vers=4,soft,timeo=180,bg,tcp
      device: ":/volume1/backups"

services:
  molino-app:
    volumes:
      - nas_backup:/mnt/nas/backups
```

### 2. Aggiorna `.env.docker`:

```dotenv
NAS_URL=192.168.1.100
NAS_PORT=5000
NAS_PATH=/volume1/backups
```

### 3. Restart container:

```bash
docker-compose down
docker-compose up -d
```

---

## 📊 Monitoraggio

### Health Check

L'applicazione include health check automatico:

```bash
curl http://localhost:5000/api/health
# {"status":"ok"}
```

### Log

#### Tempo reale:
```bash
./deploy-nas.sh logs        # Linux/Mac
.\deploy-nas.ps1 logs       # Windows
```

#### Docker logs:
```bash
docker-compose logs -f molino-app
docker-compose logs -f nas-server
```

### Metriche Backup

```bash
# Verifica status sistema
curl http://localhost:5000/api/backup/status | jq

# Elenca backup
curl http://localhost:5000/api/backup/list | jq '.files'

# Conta backup totali
curl http://localhost:5000/api/backup/list | jq '.count'
```

---

## 🔄 Backup Automatici

### Trigger

1. **Operazioni Database**: Ogni create/update/delete attiva backup
2. **Periodico**: Ogni ora (configurabile)
3. **Avvio**: Backup iniziale all'accensione
4. **Manuale**: API `/api/backup/manual`

### Gestione Spazio

- Max 10 backup locali (configurabile in `backupService.ts`)
- Backup vecchi eliminati automaticamente
- Disponibilità su NAS (storage illimitato)

---

## 🔐 Sicurezza

### Best Practices

1. **Cambio Password JWT**:
   ```dotenv
   JWT_SECRET=your-new-secret-key
   ```

2. **Cambio Credenziali Admin**:
   ```dotenv
   DEFAULT_MASTER_USER=new-admin
   DEFAULT_MASTER_PASS=new-password
   ```

3. **Backup Criptati** (opzionale):
   - Implementare encryption in `backupService.ts`
   - Usare volume criptato Docker

4. **Controllo Accesso NAS**:
   - Limitare IP autorizzati
   - Usare credenziali NAS separate

---

## 🐛 Troubleshooting

### Problema: "Connection Refused" al NAS

**Soluzione**:
```bash
# Verifica che nas-server sia running
docker-compose ps

# Testa connessione
curl http://localhost:5001/api/backup/list
```

### Problema: Backup non viene creato

**Soluzione**:
```bash
# Verifica log
docker-compose logs molino-app | grep -i backup

# Crea backup manuale
curl -X POST http://localhost:5000/api/backup/manual
```

### Problema: Database non si ripristina

**Soluzione**:
1. Ferma container: `docker-compose down`
2. Pulisci database: `rm -rf server/prisma/data/`
3. Ripristina: `docker-compose up -d`
4. Verifica log

### Problema: Spazio insufficiente

**Soluzione**:
```bash
# Elimina backup vecchi
docker exec molino-briganti-task-manager rm -f backups/db-backup-*.sql

# Pulisci volumi Docker
docker volume prune
```

---

## 📈 Scaling

### Multi-Node Deployment

Per distribuire su più server:

1. **Shared Storage**: Usa NAS per backup condivisi
2. **Load Balancer**: Distribuzione traffico
3. **Database Replication**: Master-slave setup

```yaml
# docker-compose.yml avanzato
version: '3.8'

services:
  app-1:
    image: molino-app:latest
    environment:
      - NODE_ID=1
      - NAS_URL=nas-central
  
  app-2:
    image: molino-app:latest
    environment:
      - NODE_ID=2
      - NAS_URL=nas-central
```

---

## 📝 TODO / Roadmap

- [ ] Backup incrementali
- [ ] Compressione backup (gzip)
- [ ] Encryption backup (AES-256)
- [ ] Dashboard di backup web
- [ ] Notifiche email fallimento backup
- [ ] Replica multi-site
- [ ] Retention policies
- [ ] Audit log

---

## 📞 Support

Per problemi o domande:
- GitHub: https://github.com/giuseppePintus/Molino_briganti_task_manager
- Issues: https://github.com/giuseppePintus/Molino_briganti_task_manager/issues

---

**Ultima modifica**: January 2024  
**Versione**: 1.0.0  
**Autore**: Molino Briganti Development Team
