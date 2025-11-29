# 📑 Indice Completo - Deploy NAS Molino Task Manager

## 🎯 Punto di Partenza

**LEGGI PRIMA**: [`NAS_DEPLOYMENT_SOLUTION.md`](NAS_DEPLOYMENT_SOLUTION.md) - Soluzione completa del problema

---

## 📚 Guida per Uso

### Se stai risolvendo l'errore "Failed to pull image"
→ Leggi: [`ERROR_PULL_IMAGE.md`](ERROR_PULL_IMAGE.md)

### Se vuoi deploy automatico (CONSIGLIATO)
→ Usa: [`deploy-nas.ps1`](deploy-nas.ps1)
```powershell
.\deploy-nas.ps1 -NasIP 192.168.1.100 -NasUser root -NasPassword password
```

### Se preferisci deploy manuale passo-passo
→ Leggi: [`DEPLOY_NAS.md`](DEPLOY_NAS.md)

### Se vuoi capire tutti i file di deployment
→ Leggi: [`DEPLOYMENT_FILES.md`](DEPLOYMENT_FILES.md)

---

## 📄 File di Configuration

### Principale: `docker-compose.nas.yml`
- **Tipo**: YAML (Docker Compose config)
- **Uso**: Configurazione container per NAS
- **Contiene**: Build locale + persistenza dati
- **Comando**: `docker-compose -f docker-compose.nas.yml up -d --build`

### Backup: `docker-compose.yml`
- **Tipo**: YAML (Docker Compose config)
- **Uso**: Configurazione per localhost (Windows)
- **Status**: Funzionante, ma `docker-compose.nas.yml` è preferibile per NAS
- **Comando**: `docker-compose up -d --build`

### Build: `Dockerfile`
- **Tipo**: Dockerfile
- **Uso**: Istruzioni per build dell'immagine
- **Status**: Corretto (path relativi al context corrente)
- **Multi-stage**: Builder + Production stages

---

## 🚀 File di Deployment

### `deploy-nas.ps1` - CONSIGLIATO ⭐
- **Tipo**: PowerShell script
- **Sistema**: Windows
- **Uso**: Automatizza tutto il deploy
- **Parametri**:
  - `-NasIP` (required): IP NAS
  - `-NasUser` (default: root)
  - `-NasPassword` (optional)
  - `-LocalPath` (default: progetto locale)
  - `-NasPath` (default: /nas/molino/app)

**Cosa fa**:
1. Crea directory su NAS
2. Copia file via SCP
3. Build locale
4. Avvia container
5. Testa API

**Uso**:
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app
.\deploy-nas.ps1 -NasIP 192.168.1.100 -NasUser root -NasPassword yourpassword
```

---

## 📖 File di Documentazione

### `NAS_DEPLOYMENT_SOLUTION.md` - MAIN GUIDE
**Contenuto**: Riepilogo completo della soluzione
- Problema
- Causa
- Soluzione
- Procedure (automatica e manuale)
- Verifiche post-deploy
- Test di persistenza
- Troubleshooting

### `DEPLOY_NAS.md` - MANUAL GUIDE
**Contenuto**: Procedura step-by-step manuale
- Preparazione NAS
- Copia file
- Deploy container
- Verifica status
- Test backup
- Troubleshooting dettagliato

### `ERROR_PULL_IMAGE.md` - TROUBLESHOOTING
**Contenuto**: Soluzione specifica dell'errore
- Causa dell'errore
- Opzione 1: Usa docker-compose.nas.yml
- Opzione 2: Distribuisci pre-built image
- Checklist deploy corretto
- Troubleshooting specifico

### `DEPLOYMENT_FILES.md` - FILE REFERENCE
**Contenuto**: Descrizione di tutti i file
- Overview di ogni file
- Procedure consigliate
- Errori comuni
- Verifiche post-deploy
- Architettura deploy
- Checklist finale

---

## 🔧 File Modificati in Questo Update

### 1. Dockerfile
**Modifiche**: Path relativi corretti
```dockerfile
# Prima:
COPY task-manager-app/package*.json ./

# Dopo:
COPY package*.json ./
```

### 2. docker-compose.yml
**Modifiche**: Context corretto
```yaml
# Prima:
build:
  context: ..
  dockerfile: task-manager-app/Dockerfile

# Dopo:
build:
  context: .
  dockerfile: Dockerfile
```

### 3. docker-compose.nas.yml (NUOVO)
Copia di `docker-compose.yml` esplicitamente per NAS

---

## 🎯 Scelta Rapida

| Scenario | Azione | File |
|----------|--------|------|
| 🆕 Primo deploy | Esegui script | `deploy-nas.ps1` |
| 🔧 Deploy manuale | Segui guida | `DEPLOY_NAS.md` |
| ❌ Errore pull | Leggi soluzione | `ERROR_PULL_IMAGE.md` |
| 📚 Tutti i dettagli | Riepilogo generale | `DEPLOYMENT_FILES.md` |
| 🎯 Visione d'insieme | Leggi prima | `NAS_DEPLOYMENT_SOLUTION.md` |

---

## ✅ Quick Start (5 minuti)

```powershell
# 1. Apri PowerShell
# 2. Naviga alla directory
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app

# 3. Esegui lo script
.\deploy-nas.ps1 -NasIP <IP_NAS> -NasUser root -NasPassword <PASSWORD>

# 4. Attendi completamento (5-10 minuti per il build)

# 5. Accedi al browser
# URL: http://<IP_NAS>:5000
# User: Manuel
# Pass: 123
```

---

## 📊 Architettura Risultante

```
┌─────────────────────────────────────────┐
│        Windows (Local Machine)          │
│                                         │
│  ✅ docker-compose.yml (local test)    │
│  ✅ Dockerfile (build instructions)    │
│  ✅ deploy-nas.ps1 (automation)        │
│  ✅ All source code                    │
└────────────┬────────────────────────────┘
             │
             │ scp copy + build
             ▼
┌─────────────────────────────────────────┐
│         NAS Server (Linux)              │
│                                         │
│  /nas/molino/app/                      │
│  ├── ✅ docker-compose.nas.yml         │
│  ├── ✅ Dockerfile                     │
│  └── ✅ All source code                │
│                                         │
│  /data/molino/                         │
│  ├── tasks.db (persistent)             │
│  └── backups/ (persistent)             │
└────────────┬────────────────────────────┘
             │
             │ docker build
             ▼
┌─────────────────────────────────────────┐
│    Docker Containers (Running)          │
│                                         │
│  🔵 molino-app (port 5000)             │
│  🔵 nas-backup-server (port 5001)      │
└─────────────────────────────────────────┘
```

---

## 🔍 Verifica e Validazione

### Test Health Check
```bash
curl http://<NAS_IP>:5000/api/health
# Atteso: {"status":"ok"}
```

### Test Backup API
```bash
curl http://<NAS_IP>:5001/api/backup/status
# Atteso: {"success":true,...}
```

### Test Persistenza
```bash
# 1. Stop container
docker-compose -f docker-compose.nas.yml down

# 2. Start container
docker-compose -f docker-compose.nas.yml up -d

# 3. Verifica dati ancora presenti
docker exec molino-nas-backup-server ls -la /data/molino/backups/
# I file devono essere gli stessi!
```

---

## 🎓 Concetti Chiave Implementati

1. **Build Locale**: Docker non tenta pull da Hub, fa build locale
2. **Bind Mount**: `/data/molino` mappato a host filesystem per persistenza
3. **Multi-stage Build**: Separazione build stage e production stage
4. **Health Checks**: Monitoraggio automatico stato container
5. **Networking**: Container comunicano via bridge network
6. **Environment Isolation**: Variabili d'ambiente per config

---

## 📞 Supporto Rapido

**Problema**: Errore durante build
```bash
docker-compose -f docker-compose.nas.yml logs -f
```

**Problema**: Container non si avvia
```bash
docker-compose -f docker-compose.nas.yml ps
docker-compose -f docker-compose.nas.yml restart molino-app
```

**Problema**: SCP fallisce
```bash
# Verifica SSH prima
ssh -v root@<NAS_IP> "echo OK"
```

**Problema**: Spazio disco pieno
```bash
ssh root@<NAS_IP> "df -h"
# Libera spazio se necessario
```

---

## 🚀 Prossimi Passi

1. ✅ Leggi `NAS_DEPLOYMENT_SOLUTION.md`
2. ✅ Esegui `.\deploy-nas.ps1` con i tuoi parametri
3. ✅ Verifica health check
4. ✅ Accedi web UI
5. ✅ Crea ordine di test
6. ✅ Testa backup e persistenza
7. ✅ Monitora log container

---

**Creato**: 26 Novembre 2025
**Status**: ✅ Pronto per deployment
**Versione**: 1.0
