# 🔐 Configurazione SSH NAS - Molino Briganti

## Credenziali SSH - ✅ VERIFICATE E FUNZIONANTI

```
IP:       192.168.1.248
Username: vsc
Password: vsc12345
```

## Verifica Connessione

```powershell
ssh vsc@192.168.1.248 "echo test"
```

## Docker sul NAS

```
Percorso: /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker
```

### Comando Docker da SSH

```bash
ssh -t vsc@192.168.1.248 "source /etc/profile; /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker ps"
```

## Container Attivo

```
Status: ✅ UP (46 minutes)
Image: c1ppo/molino-task-manager:latest
Porta: 0.0.0.0:5000->5000/tcp
Health: HEALTHY
```

## Script Helper Disponibili

### 1. PowerShell Helper (ssh-nas-helper.ps1)
```powershell
. .\ssh-nas-helper.ps1

# Comandi disponibili:
Test-NasConnection                              # Testa connessione
Get-NasDockerStatus                             # Vedi container Docker
Invoke-NasCommand "whoami"                      # Esegui comando
Invoke-NasCommand "docker ps" -UseDocker $true  # Esegui Docker
```

### 2. Deploy Script (deploy-to-nas.ps1)
```powershell
.\deploy-to-nas.ps1 -ImageTag "c1ppo/molino-task-manager:latest"
```

Esegue automaticamente:
- Stop vecchio container
- Pull nuova immagine
- Setup directory backup
- Avvio container
- Health check

## Directory Importanti sul NAS

```
Database:    /share/CACHEDEV1_DATA/molino/tasks.db
Backups:     /share/CACHEDEV1_DATA/molino/backups/
Docker:      /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker
```

## Comandi Utili

### Vedere i log
```bash
ssh vsc@192.168.1.248 "source /etc/profile; /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker logs molino-task-manager"
```

### Vedere i backup
```bash
ssh vsc@192.168.1.248 "ls -lh /share/CACHEDEV1_DATA/molino/backups/"
```

### Entrare nel container
```bash
ssh vsc@192.168.1.248 "source /etc/profile; /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker exec -it molino-task-manager sh"
```

### Riavviare container
```bash
ssh vsc@192.168.1.248 "source /etc/profile; /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-task-manager"
```

## File di Configurazione Salvati

- `.nas_ssh_config` - Configurazione SSH (con credenziali)
- `ssh-nas-helper.ps1` - Script PowerShell helper
- `deploy-to-nas.ps1` - Script deploy automatico

## Note Importanti

1. **Sempre usare `-t` con ssh** per avere pseudo-terminal
2. **Sempre usare `source /etc/profile`** per caricare il PATH del NAS
3. **Docker è in un percorso custom** `/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker`
4. **Password memorizzata** negli script per automatizzazione

## Accesso Web

```
URL: http://192.168.1.248:5000
```

---

✅ **Setup Completato il 29/11/2025**
