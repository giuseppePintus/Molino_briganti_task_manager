# Docker Registry Privato - Setup e Gestione

## Situazione
- ✅ Questo PC ha Docker con l'immagine `molino-task-manager:latest`
- ❌ Il NAS non ha Docker e non può buildare
- ❌ Il NAS cerca di fare pull da Docker Hub (fallisce)
- ✅ **SOLUZIONE**: Esporre un Docker Registry privato da questo PC

---

## Metodo 1: Docker Registry su HTTP (SEMPLICE)

### Passo 1: Avvia il Registry su questo PC
```powershell
# Avvia un container Registry che espone il servizio su porta 5002
docker run -d `
  --name local-registry `
  --restart unless-stopped `
  -p 5002:5000 `
  registry:2

# Verifica che sia running
docker ps | Select-String "local-registry"
```

### Passo 2: Testa il registry
```powershell
# Curl per verificare che risponda
curl -s http://localhost:5002/v2/ | ConvertFrom-Json
# Atteso: { } (risposta vuota significa OK)
```

### Passo 3: Taglia l'immagine per il registry
```powershell
# Tagga l'immagine con il nome del registry
docker tag molino-task-manager:latest localhost:5002/molino-task-manager:latest
```

### Passo 4: Pusha l'immagine nel registry
```powershell
# Pusha nel registry locale
docker push localhost:5002/molino-task-manager:latest
```

### Passo 5: Verifica che l'immagine sia nel registry
```powershell
# Lista le immagini nel registry
curl -s http://localhost:5002/v2/_catalog | ConvertFrom-Json | Select-Object -ExpandProperty repositories
# Atteso: @("molino-task-manager")
```

---

## Metodo 2: Script Automatico (CONSIGLIATO)

Usa questo script PowerShell che automatizza tutto:

```powershell
# .\setup-registry-and-push.ps1

Write-Host "🐳 Setup Docker Registry Privato" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Step 1: Verifica se il registry è già running
Write-Host ""
Write-Host "📋 Step 1: Verificando registry locale..." -ForegroundColor Yellow

$registryRunning = docker ps | Select-String "local-registry"
if ($registryRunning) {
    Write-Host "✅ Registry già in esecuzione" -ForegroundColor Green
} else {
    Write-Host "🚀 Avviando registry..." -ForegroundColor Yellow
    docker run -d `
      --name local-registry `
      --restart unless-stopped `
      -p 5002:5000 `
      registry:2
    
    Start-Sleep -Seconds 3
    Write-Host "✅ Registry avviato su porta 5002" -ForegroundColor Green
}

# Step 2: Verifica immagine locale
Write-Host ""
Write-Host "📦 Step 2: Verificando immagine locale..." -ForegroundColor Yellow
$imageExists = docker images | Select-String "molino-task-manager.*latest"
if (-not $imageExists) {
    Write-Host "❌ Immagine non trovata! Esegui docker-compose build" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Immagine trovata" -ForegroundColor Green

# Step 3: Taglia l'immagine
Write-Host ""
Write-Host "🏷️  Step 3: Taggando immagine..." -ForegroundColor Yellow
docker tag molino-task-manager:latest localhost:5002/molino-task-manager:latest
Write-Host "✅ Taggata come: localhost:5002/molino-task-manager:latest" -ForegroundColor Green

# Step 4: Pusha nel registry
Write-Host ""
Write-Host "📤 Step 4: Pushando nel registry..." -ForegroundColor Yellow
docker push localhost:5002/molino-task-manager:latest
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Push completato con successo" -ForegroundColor Green
} else {
    Write-Host "❌ Errore durante push" -ForegroundColor Red
    exit 1
}

# Step 5: Verifica
Write-Host ""
Write-Host "🔍 Step 5: Verificando registry..." -ForegroundColor Yellow
$catalogResult = curl -s http://localhost:5002/v2/_catalog
$catalog = $catalogResult | ConvertFrom-Json
Write-Host "✅ Immagini nel registry:" -ForegroundColor Green
$catalog.repositories | ForEach-Object { Write-Host "   - $_" -ForegroundColor White }

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "✅ Registry pronto per il NAS!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Istruzioni per il NAS:" -ForegroundColor Cyan
Write-Host "   URL: http://<YOUR_PC_IP>:5002" -ForegroundColor White
Write-Host "   Image: <YOUR_PC_IP>:5002/molino-task-manager:latest" -ForegroundColor White
Write-Host ""
Write-Host "Modifica il docker-compose.nas.yml sul NAS con:" -ForegroundColor Cyan
Write-Host "   image: <YOUR_PC_IP>:5002/molino-task-manager:latest" -ForegroundColor White
```

---

## Configurazione NAS per il Registry

### Passo 1: Scopri l'IP di questo PC
```powershell
# Windows - trova l'IP della tua macchina
ipconfig | Select-String "IPv4 Address"
# Atteso: 192.168.1.100 (o simile)
```

### Passo 2: Modifica docker-compose.nas.yml sul NAS
Sul NAS, modifica il file `/nas/molino/app/docker-compose.nas.yml`:

```yaml
services:
  molino-app:
    # ❌ VECCHIO:
    # image: molino-task-manager:latest
    
    # ✅ NUOVO:
    image: 192.168.1.100:5002/molino-task-manager:latest  # Usa il tuo IP!
    
    # Mantieni i rest della configurazione uguale
    restart: unless-stopped
    # ...
```

### Passo 3: Avvia i container dal NAS
```bash
# SSH al NAS
ssh root@192.168.1.100

# Naviga alla directory app
cd /nas/molino/app

# Ferma vecchi container
docker-compose -f docker-compose.nas.yml down

# Avvia - Docker farà automaticamente il pull dal tuo registry
docker-compose -f docker-compose.nas.yml up -d

# Verifica lo stato
docker-compose -f docker-compose.nas.yml ps

# Vedi i log (utile per debugging)
docker-compose -f docker-compose.nas.yml logs -f
```

---

## Verifica Funzionamento

### Dal tuo PC
```powershell
# Verifica che il registry stia servendo l'immagine
curl -s http://localhost:5002/v2/_catalog | ConvertFrom-Json

# Lista i tag disponibili
curl -s http://localhost:5002/v2/molino-task-manager/tags/list | ConvertFrom-Json
```

### Dal NAS
```bash
# Verifica che Docker abbia fatto pull
docker images | grep molino-task-manager

# Verifica che i container siano running
docker ps

# Health check
curl http://localhost:5000/api/health
```

---

## Troubleshooting

### Errore: "failed to pull image ... connection refused"
**Causa**: Il registry non è raggiungibile dal NAS (firewall o IP sbagliato)
**Soluzione**:
1. Verifica che il registry sia running: `docker ps | grep registry`
2. Verifica l'IP: `ipconfig`
3. Testa connettività dal NAS: `ping <YOUR_PC_IP>`
4. Testa il registry dal NAS: `curl http://<YOUR_PC_IP>:5002/v2/`

### Errore: "insecure registry"
**Causa**: Docker su NAS non sa che il registry è trusted
**Soluzione**: Aggiungi il registry a `/etc/docker/daemon.json` sul NAS
```json
{
  "insecure-registries": ["192.168.1.100:5002"]
}
```
Poi riavvia Docker: `systemctl restart docker`

### Errore: "image not found in registry"
**Soluzione**: Verifica che il push sia riuscito
```powershell
curl -s http://localhost:5002/v2/_catalog | ConvertFrom-Json
# Deve contenere "molino-task-manager"
```
Se non c'è, rifai il push:
```powershell
docker push localhost:5002/molino-task-manager:latest
```

### Registry consuma troppo spazio disco
**Soluzione**: Pulisci le immagini non usate
```powershell
# Ferma il registry
docker stop local-registry

# Rimuovi il container (ma non l'immagine di registry)
docker rm local-registry

# Ricrea con un volume per salvare i dati
docker run -d `
  --name local-registry `
  --restart unless-stopped `
  -p 5002:5000 `
  -v registry-storage:/var/lib/registry `
  registry:2
```

---

## Comandi Utili

### Visualizza tutte le immagini nel registry
```powershell
curl -s http://localhost:5002/v2/_catalog | ConvertFrom-Json | Select-Object -ExpandProperty repositories
```

### Visualizza i tag di un'immagine
```powershell
curl -s http://localhost:5002/v2/molino-task-manager/tags/list | ConvertFrom-Json
```

### Ferma il registry
```powershell
docker stop local-registry
```

### Riavvia il registry
```powershell
docker restart local-registry
```

### Visualizza i log del registry
```powershell
docker logs local-registry
```

---

## Architettura Finale

```
┌─────────────────────────────────────────────────────────┐
│ Tuo PC (Windows)                                        │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Docker Engine                                      │  │
│ │  ┌──────────────────────────┐                     │  │
│ │  │ molino-task-manager      │  (Immagine locale)  │  │
│ │  └──────────────────────────┘                     │  │
│ │  ┌──────────────────────────┐                     │  │
│ │  │ Registry:2 (port 5002)   │  ◄── Pusha immagine│  │
│ │  │ localhost:5002/...       │                     │  │
│ │  └──────────────────────────┘                     │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        ▲
                        │ Pull via HTTP
                        │ 192.168.1.100:5002
                        │
┌─────────────────────────────────────────────────────────┐
│ NAS (Linux)                                             │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Docker Engine                                      │  │
│ │  ┌──────────────────────────┐                     │  │
│ │  │ molino-task-manager      │  ◄── Pull da PC     │  │
│ │  │ (192.168.1.100:5002/..) │  (container running)│  │
│ │  └──────────────────────────┘                     │  │
│ │  ┌──────────────────────────┐                     │  │
│ │  │ Applicazione su          │                     │  │
│ │  │ http://nas:5000          │                     │  │
│ │  └──────────────────────────┘                     │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Note Importanti

1. **HTTP non è sicuro**: Questo registry è su HTTP (non HTTPS). Non adatto per internet, solo LAN privata.
2. **Firewall**: Assicurati che la porta 5002 sia aperta tra il tuo PC e il NAS.
3. **IP statico**: Usa un IP statico per il tuo PC o aggiornerai continuamente docker-compose.nas.yml
4. **Immagini multiple**: Puoi pushare più immagini nello stesso registry.
