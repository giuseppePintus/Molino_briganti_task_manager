# Diagnosi Incompatibilità Docker Hub - Guida Completa

## 🔍 Step 1: Diagnosticare l'Architettura del NAS

```bash
# SSH al NAS
ssh root@<NAS_IP>

# Scopri l'architettura del NAS
uname -m

# Possibili risultati:
# x86_64   → AMD/Intel 64-bit (es. server NAS, NAS custom Linux)
# aarch64  → ARM 64-bit (es. Synology, QNAP moderni, Raspberry Pi 4+)
# armv7l   → ARM 32-bit (es. Raspberry Pi 3, vecchi QNAP)
# armv6l   → ARM 32-bit (es. Raspberry Pi Zero/1)
```

---

## 🔍 Step 2: Verifica la Versione di Docker

```bash
# Dal NAS
docker --version

# Atteso: Docker version 20.10.x o superiore
# Se < 20.10: Potrebbe avere limitazioni su immagini multi-arch
```

---

## 🔍 Step 3: Verifica Quale Immagine il NAS Sta Cercando

```bash
# Controlla il docker-compose.yml attuale sul NAS
cat /nas/molino/app/docker-compose.yml | grep image

# O visualizza direttamente i container in esecuzione
docker images

# O tenta il pull manuale per vedere l'errore esatto
docker pull molino-task-manager:latest
```

---

## ⚠️ Possibili Problemi e Soluzioni

### Problema 1: NAS è ARM64 (aarch64) ma immagine è solo amd64

**Segni riconoscibili:**
```
Error: exec format error
Errore: invalid ELF class ELFCLASS32/ELFCLASS64
```

**Causa**: L'immagine costruita su Windows è amd64, il NAS è ARM64

**Soluzione A: Costruire immagine multi-arch (CONSIGLIATO)**
```powershell
cd c:\Users\manue\Molino_briganti_task_manager\task-manager-app

# Costruisci immagine per amd64 E arm64
.\build-multiarch.ps1

# Questa crea un'immagine che funziona su entrambi gli NAS
```

**Soluzione B: Costruire solo per arm64**
```powershell
# Se vuoi solo arm64
docker buildx build --platform linux/arm64 -t molino-task-manager:latest --load .

# Ma non funzionerà su Windows/PC
```

**Soluzione C: Buildare localmente sul NAS**
```bash
# Sul NAS
cd /nas/molino/app
docker-compose -f docker-compose.nas.yml up -d --build

# Fa il build direttamente sul NAS (funzionerà con l'architettura giusta)
# Richiederà 10-15 minuti
```

---

### Problema 2: Immagine non trovata in Docker Hub

**Errore:**
```
Error response from daemon: pull access denied for molino-task-manager
```

**Causa**: L'immagine `molino-task-manager:latest` non esiste pubblicamente

**Soluzione**: 
- **Opzione 1**: Fare il build locale (consigliato)
  ```bash
  ssh root@<NAS_IP>
  cd /nas/molino/app
  docker-compose -f docker-compose.nas.yml down
  docker-compose -f docker-compose.nas.yml up -d --build
  ```

- **Opzione 2**: Usare uno script deployment che fa il build
  ```powershell
  .\deploy-nas-with-build.ps1 -NasIp 192.168.1.100
  ```

---

### Problema 3: Errore di compatibilità con libc/glibc

**Errore:**
```
/lib/libc.musl-x86_64.so.1: version `GLIBC_x.xx' not found
```

**Causa**: La base image `node:18` usa una versione di libc incompatibile

**Soluzione**: Modifica il Dockerfile per usare una base image più stabile
```dockerfile
# Usa node:18-alpine per NAS ARM
FROM node:18-alpine

# O usa specificamente glibc se necessario
FROM node:18-slim  # Usa debian slim che ha glibc universale
```

---

## 📋 Checklist Diagnostica Rapida

```bash
# Esegui tutto questo dal NAS

# 1. Architettura
echo "=== Architettura ==="
uname -m

# 2. Docker version
echo "=== Docker Version ==="
docker --version

# 3. Prova pull dell'immagine vecchia
echo "=== Test Pull ==="
docker pull molino-task-manager:latest 2>&1 | head -20

# 4. Immagini locali
echo "=== Immagini Locali ==="
docker images

# 5. Spazio disco disponibile
echo "=== Spazio Disco ==="
df -h /

# 6. RAM disponibile
echo "=== RAM ==="
free -h
```

---

## 🛠️ Soluzione Consigliata Basata su Architettura

### Se NAS è x86_64 (Intel/AMD)
✅ **Usa**: `docker-compose.nas.yml` con build locale
- Immagine amd64 che abbiamo costruito funziona
- Non c'è incompatibilità
- Se il pull fallisce: è problema di connettività/permessi

### Se NAS è aarch64 (ARM 64-bit - Synology/QNAP moderno)
✅ **Soluzione Migliore**: Build multi-arch
```powershell
.\build-multiarch.ps1
```
Questo crea un'immagine che supporta sia amd64 che aarch64

### Se NAS è armv7l (ARM 32-bit - Raspberry Pi 3/vecchi QNAP)
✅ **Soluzione**: Build specifico per armv7
```powershell
docker buildx build --platform linux/arm/v7 -t molino-task-manager:latest --load .
```

### Se non sai l'architettura
✅ **Soluzione Universale**: Build multi-arch che supporta tutte
```powershell
.\build-multiarch.ps1
```
Supporta amd64, aarch64, arm/v7, arm/v6

---

## 🚀 Workflow Completo per Risolvere

### Step 1: Diagnosticare il NAS
```bash
ssh root@<NAS_IP>
uname -m    # Scopri architettura
docker --version    # Scopri versione
```

### Step 2: Basato sul risultato

**Se x86_64:**
```powershell
# Usa il build locale (docker-compose.nas.yml)
.\deploy-nas-with-build.ps1 -NasIp 192.168.1.100
```

**Se aarch64 (ARM64):**
```powershell
# Costruisci multi-arch che supporta ARM
.\build-multiarch.ps1

# Poi dal NAS fai pull
# docker pull molino-task-manager:latest
```

**Se armv7l (ARM32):**
```powershell
# Costruisci specificamente per arm/v7
docker buildx build --platform linux/arm/v7 -t molino-task-manager:latest --load .

# Sul NAS: docker pull molino-task-manager:latest
```

---

## 📞 Comandi Utili per Debugging

```bash
# Dal NAS, se il pull fallisce

# 1. Verifica che Docker sia online
ping 8.8.8.8

# 2. Verifica che possa raggiungere Docker Hub
curl -I https://registry-1.docker.io/v2/

# 3. Prova pull da Docker Hub ufficiale
docker pull library/node:18

# 4. Testa con immagine ufficiale
docker pull alpine:latest
docker run alpine uname -m

# 5. Se vuoi buildare localmente
cd /nas/molino/app
docker build -t molino-task-manager:latest .
```

---

## 💡 Raccomandazione Finale

**Il modo PIÙ sicuro e universale:**

1. Costruisci multi-arch localmente:
   ```powershell
   .\build-multiarch.ps1
   ```

2. Carica su Docker Hub (o registry privato)

3. Sul NAS fa semplice pull:
   ```bash
   docker pull molino-task-manager:latest
   # Funzionerà su x86_64, ARM64, ARM32
   ```

4. Se non vuoi Docker Hub, usa il build locale sul NAS:
   ```bash
   cd /nas/molino/app
   docker-compose -f docker-compose.nas.yml up -d --build
   ```

---

## 📝 File di Riferimento

- `build-multiarch.ps1` - Costruisce immagine multi-arch
- `deploy-nas-with-build.ps1` - Deploy con build locale
- `docker-compose.nas.yml` - Configurazione con `build:`
- `Dockerfile` - Istruzioni di build
