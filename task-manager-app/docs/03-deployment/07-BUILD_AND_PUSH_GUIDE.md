# Docker Hub Build & Push Guide (PC)

Come buildare l'immagine e pusharla su Docker Hub dal PC.

---

## ✅ Prerequisiti

- Docker Desktop installato
- Account Docker Hub (gratis: https://hub.docker.com)
- Terminale aperto nella directory del progetto

---

## 🚀 STEP 1: Login a Docker Hub

```bash
docker login
```

Inserisci:
- Username Docker Hub
- Password (o token personale)

---

## 🏗️ STEP 2: Build Immagine

```bash
cd Molino_briganti_task_manager/task-manager-app

# Build con il tuo username
docker build -f Dockerfile.hub -t TUO_USERNAME/molino-briganti:latest .

# Verifica che sia buildata
docker images | grep molino-briganti
```

**Output atteso:**
```
REPOSITORY                    TAG       IMAGE ID      CREATED
TUO_USERNAME/molino-briganti  latest    abc123def456  2 seconds ago
```

---

## 📤 STEP 3: Push su Docker Hub

```bash
docker push TUO_USERNAME/molino-briganti:latest
```

**Primo push:** 5-10 minuti (upload big)  
**Push successivi:** Più veloce (solo layer modificati)

---

## ✅ STEP 4: Verifica su Docker Hub

Visita: https://hub.docker.com/repositories

Dovresti vedere `molino-briganti` nei tuoi repository.

---

## 🎯 Sul NAS: Usa l'Immagine

```bash
DOCKER_HUB_IMAGE=TUO_USERNAME/molino-briganti:latest ./deploy-nas.sh setup
```

---

## 🔄 Update Futuri

Quando modifichi il codice:

```bash
# PC:
docker build -f Dockerfile.hub -t TUO_USERNAME/molino-briganti:latest .
docker push TUO_USERNAME/molino-briganti:latest

# NAS:
docker pull TUO_USERNAME/molino-briganti:latest
docker restart molino-briganti-app
```

---

## 📝 Troubleshooting

### Errore: "no such file or directory"

Verifica di essere nella directory corretta:
```bash
ls -la Dockerfile.hub
```

### Errore: "docker: command not found"

Installa Docker Desktop:
https://www.docker.com/products/docker-desktop

### Errore: "unauthorized: incorrect username or password"

Effettua login di nuovo:
```bash
docker logout
docker login
```

### Build very lento?

Prima volta è normale (10-15 minuti).  
Successive volte sono più veloci perché usa i layer cache.

---

## 💡 Pro Tips

### Tag con versione

```bash
docker build -f Dockerfile.hub -t TUO_USERNAME/molino-briganti:v1.0.0 .
docker push TUO_USERNAME/molino-briganti:v1.0.0
```

### Vedi immagini locali

```bash
docker images
```

### Rimuovi immagine locale

```bash
docker rmi TUO_USERNAME/molino-briganti:latest
```

### Vedi log di build

```bash
docker build -f Dockerfile.hub -t ... . --progress=plain
```

---

## 🎯 Workflow Veloce

```bash
# 1. Build
docker build -f Dockerfile.hub -t TUO_USERNAME/molino-briganti:latest .

# 2. Push
docker push TUO_USERNAME/molino-briganti:latest

# 3. Sul NAS
# DOCKER_HUB_IMAGE=TUO_USERNAME/molino-briganti:latest ./deploy-nas.sh setup
```

---

**Fatto! L'immagine è pronta sul Docker Hub** 🎉
