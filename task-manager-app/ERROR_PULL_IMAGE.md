# Soluzione: Errore "pull access denied for molino-task-manager"

## 🔴 Errore

```
Failed to pull image "docker.io/library/molino-task-manager:latest"
Error message: failed to pull image docker.io/library/molino-task-manager:latest
[Error response from daemon: pull access denied for molino-task-manager, repository 
does not exist or may require 'docker login': denied: requested access to the resource is denied]
```

## 🔍 Causa

Docker sta cercando di fare **PULL** dell'immagine `molino-task-manager:latest` da Docker Hub, ma:
1. L'immagine NON esiste su Docker Hub (è privata/locale)
2. Il file `docker-compose.yml` ha `image: molino-task-manager:latest` **senza** `build:` configurato

## ✅ Soluzione

### Opzione 1: Usa `docker-compose.nas.yml` sul NAS

Il file **`docker-compose.nas.yml`** è stato creato specificamente per il NAS e contiene la configurazione `build:` corretta.

**Comando corretto sul NAS:**
```bash
cd /nas/molino/app
docker-compose -f docker-compose.nas.yml down
docker-compose -f docker-compose.nas.yml up -d --build
```

**Comando SBAGLIATO (che fallisce):**
```bash
# ❌ NO - Questo tenterà il PULL
docker-compose up -d --build
```

### Opzione 2: Distribuisci l'immagine pre-built

Se vuoi usare `docker-compose.yml` tradizionale, puoi:

**1. Build locale su Windows**
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app
docker build -t molino-task-manager:latest .
```

**2. Salva l'immagine**
```powershell
docker save molino-task-manager:latest -o molino-task-manager.tar
```

**3. Trasferisci al NAS**
```powershell
scp molino-task-manager.tar root@<NAS_IP>:/tmp/
```

**4. Carica sul NAS**
```bash
ssh root@<NAS_IP>
docker load -i /tmp/molino-task-manager.tar
```

**5. Avvia con docker-compose normale**
```bash
cd /nas/molino/app
docker-compose up -d
```

---

## 📋 Checklist Deploy Corretto

- [ ] **Usa `docker-compose.nas.yml`** (non `docker-compose.yml`)
- [ ] Il file contiene `build:` con `context: .` e `dockerfile: Dockerfile`
- [ ] La directory contiene il `Dockerfile`
- [ ] Esegui: `docker-compose -f docker-compose.nas.yml up -d --build`
- [ ] Attendi il build (5-10 minuti la prima volta)
- [ ] Verifica: `docker-compose -f docker-compose.nas.yml ps`
- [ ] Test: `curl http://localhost:5000/api/health`

---

## 🚀 Differenza tra i file

### `docker-compose.yml` (localhost/test)
```yaml
services:
  molino-app:
    build:                          # ✅ Ha build:
      context: .
      dockerfile: Dockerfile
    image: molino-task-manager:latest
```
Usa il **build locale** quando eseguito con `--build`.

### `docker-compose.nas.yml` (NAS - UGUALE)
Identico a `docker-compose.yml`, ma esplicitamente per il NAS per evitare confusione.

---

## 🔧 Troubleshooting

### Errore: "Dockerfile not found"
**Soluzione**: Assicurati che il `Dockerfile` sia copiato:
```bash
ssh root@<NAS_IP> "ls -la /nas/molino/app/Dockerfile"
```

### Build fallisce: "npm install failed"
**Soluzione**: Probabilmente uno dei file `package*.json` manca. Verifica:
```bash
ssh root@<NAS_IP> "ls -la /nas/molino/app/package*.json"
```

### Errore di permission: "chmod: cannot access"
**Soluzione**: Assicurati che `/data/molino` esista:
```bash
ssh root@<NAS_IP> "mkdir -p /data/molino && chmod 755 /data/molino"
```

### Container non si avvia dopo build
**Soluzione**: Vedi i log:
```bash
ssh root@<NAS_IP> "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml logs -f molino-app"
```

---

## 📚 File Creati per il Deploy

- **`docker-compose.nas.yml`** - Configurazione docker-compose per NAS (con build: locale)
- **`deploy-nas.ps1`** - Script PowerShell di deploy automatico
- **`DEPLOY_NAS.md`** - Guida completa di deploy manuale
- **`ERROR_PULL_IMAGE.md`** - Questo file (troubleshooting errore pull)

---

## 🎯 Procedura Rapida

```bash
# 1. SSH al NAS
ssh root@<NAS_IP>

# 2. Naviga alla directory
cd /nas/molino/app

# 3. Usa il file corretto
docker-compose -f docker-compose.nas.yml up -d --build

# 4. Verifica
docker-compose -f docker-compose.nas.yml ps
curl http://localhost:5000/api/health
```

✅ **Fatto!**
