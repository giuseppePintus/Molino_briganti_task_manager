# 🏠 Accesso Backup dal NAS - Guida Pratica

## 📍 Informazioni NAS

```
🖥️  HOSTNAME: NAS QNAP (NAS71F89C)
🌐 IP: 192.168.1.248
🔑 USER: vsc
🔐 PASSWORD: (fornita durante setup)
🗂️  PERCORSO BACKUP: /share/CACHEDEV1_DATA/Container/data/molino/backups/
📁 WINDOWS: \\NAS71F89C\Container\data\molino\backups\
```

### 📂 Struttura Cartelle Backup

```
\\NAS71F89C\Container\data\molino\backups\
├── database/     ← Backup SQLite (.sql)
├── logs/         ← Log applicazione
└── config/       ← File configurazione
```

---

## ✅ Metodo 1: SSH da Windows (PowerShell)

### 1️⃣ Connessione SSH al NAS

```powershell
# Apri PowerShell e connettiti
ssh vsc@192.168.1.248

# Quando chiede password, inserisci la password NAS
```

### 2️⃣ Navigare ai backup

```bash
# Una volta collegato via SSH
cd /share/CACHEDEV1_DATA/molino/backups

# Vedi lista backup
ls -lah

# Oppure in format dettagliato
ls -lh db-backup-*.sql
```

### 3️⃣ Verificare spazio

```bash
# Spazio utilizzato dai backup
du -sh /share/CACHEDEV1_DATA/molino/backups

# Spazio disponibile su NAS
df -h /share/CACHEDEV1_DATA
```

### 4️⃣ Scaricare un backup

```powershell
# Dalla finestra PowerShell (locale Windows)
# Scarica un backup specifico dal NAS

scp vsc@192.168.1.248:/share/CACHEDEV1_DATA/molino/backups/db-backup-2025-12-03T20-24-48-958Z.sql C:\Users\manue\Downloads\
```

### 5️⃣ Caricare backup sul NAS

```powershell
# Carica un file di backup dal tuo PC al NAS

scp C:\Users\manue\Downloads\db-backup.sql vsc@192.168.1.248:/share/CACHEDEV1_DATA/molino/backups/
```

---

## ✅ Metodo 2: Accesso tramite Interfaccia Web NAS

### 1️⃣ Apri browser

```
http://192.168.1.248:8080
oppure
http://192.168.1.248:8081
```

### 2️⃣ Login
```
User: vsc
Password: (password NAS)
```

### 3️⃣ Naviga a File Manager

```
File Manager → share → CACHEDEV1_DATA → molino → backups
```

### 4️⃣ Scarica backup direttamente dal browser
- Fai clic destro su file backup
- Seleziona "Download"

---

## ✅ Metodo 3: Network Drive (Windows Explorer)

### 1️⃣ Mappa unità di rete

```powershell
# Apri PowerShell come Amministratore

# Crea cartella di mount
New-Item -ItemType Directory -Force -Path "C:\NAS_Molino"

# Monta il percorso NAS
net use Z: \\192.168.1.248\molino-backups /user:vsc password
```

⚠️ Sostituisci `password` con la password reale del NAS

### 2️⃣ Accedi tramite Windows Explorer

```
Windows Explorer → Z: (oppure altro drive letter)
└── backups/
    ├── db-backup-2025-12-03T20-24-48-958Z.sql
    ├── db-backup-2025-12-03T19-24-49-159Z.sql
    └── ...
```

### 3️⃣ Scarica/carica backup tramite drag-and-drop

```
Seleziona file → Copia in C:\Local\Path
```

### 4️⃣ Smonta unità quando finito

```powershell
net use Z: /delete
```

---

## ✅ Metodo 4: Script PowerShell Automatico

### 📝 Script: Lista Backup NAS

```powershell
# Save as: List-NAS-Backups.ps1

param(
    [string]$NasIp = "192.168.1.248",
    [string]$NasUser = "vsc",
    [string]$NasPath = "/share/CACHEDEV1_DATA/molino/backups"
)

Write-Host "🏠 Collegamento a NAS: $NasIp" -ForegroundColor Cyan

# Esegui comando SSH
ssh "$NasUser@$NasIp" "ls -lh $NasPath/db-backup-*.sql | tail -20"

Write-Host "`n✅ Backup NAS elencati!" -ForegroundColor Green
```

**Uso:**
```powershell
.\List-NAS-Backups.ps1
```

---

### 📝 Script: Scarica Backup dal NAS

```powershell
# Save as: Download-NAS-Backup.ps1

param(
    [string]$BackupName,
    [string]$DownloadPath = "C:\Users\manue\Downloads",
    [string]$NasIp = "192.168.1.248",
    [string]$NasUser = "vsc"
)

if (-not $BackupName) {
    Write-Host "❌ Specifica il nome backup!" -ForegroundColor Red
    Write-Host "Uso: .\Download-NAS-Backup.ps1 -BackupName 'db-backup-2025-12-03T20-24-48-958Z.sql'" -ForegroundColor Yellow
    exit 1
}

$NasPath = "/share/CACHEDEV1_DATA/molino/backups/$BackupName"
$LocalPath = "$DownloadPath\$BackupName"

Write-Host "📥 Scaricando da NAS..." -ForegroundColor Cyan
Write-Host "   NAS Path: $NasPath" -ForegroundColor Gray
Write-Host "   Local Path: $LocalPath" -ForegroundColor Gray

scp "$NasUser@$NasIp`:$NasPath" "$LocalPath"

if (Test-Path $LocalPath) {
    $Size = (Get-Item $LocalPath).Length / 1MB
    Write-Host "✅ Scaricamento completato! ($([math]::Round($Size, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host "❌ Scaricamento fallito!" -ForegroundColor Red
}
```

**Uso:**
```powershell
.\Download-NAS-Backup.ps1 -BackupName "db-backup-2025-12-03T20-24-48-958Z.sql"
```

---

### 📝 Script: Copia Backup Locale su NAS

```powershell
# Save as: Upload-Backup-To-NAS.ps1

param(
    [string]$LocalBackupPath,
    [string]$NasIp = "192.168.1.248",
    [string]$NasUser = "vsc"
)

if (-not (Test-Path $LocalBackupPath)) {
    Write-Host "❌ File non trovato: $LocalBackupPath" -ForegroundColor Red
    exit 1
}

$FileName = Split-Path $LocalBackupPath -Leaf
$NasPath = "/share/CACHEDEV1_DATA/molino/backups/$FileName"

$Size = (Get-Item $LocalBackupPath).Length / 1MB
Write-Host "📤 Caricando su NAS..." -ForegroundColor Cyan
Write-Host "   File: $FileName ($([math]::Round($Size, 2)) MB)" -ForegroundColor Gray
Write-Host "   NAS Path: $NasPath" -ForegroundColor Gray

scp "$LocalBackupPath" "$NasUser@$NasIp`:$NasPath"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Caricamento completato!" -ForegroundColor Green
} else {
    Write-Host "❌ Caricamento fallito!" -ForegroundColor Red
}
```

**Uso:**
```powershell
.\Upload-Backup-To-NAS.ps1 -LocalBackupPath "C:\Users\manue\Downloads\backup.sql"
```

---

### 📝 Script: Sincronizza Backup Locale ↔ NAS

```powershell
# Save as: Sync-Backups.ps1

param(
    [string]$Direction = "both",  # "pull" (NAS→Local), "push" (Local→NAS), "both"
    [string]$NasIp = "192.168.1.248",
    [string]$NasUser = "vsc",
    [string]$LocalPath = "C:\Users\manue\Molino_briganti_task_manager\molino-data\backups",
    [string]$NasPath = "/share/CACHEDEV1_DATA/molino/backups"
)

Write-Host "🔄 Sincronizzazione Backup ($Direction)" -ForegroundColor Cyan
Write-Host "   Local: $LocalPath" -ForegroundColor Gray
Write-Host "   NAS:   $NasPath" -ForegroundColor Gray
Write-Host ""

if ($Direction -eq "pull" -or $Direction -eq "both") {
    Write-Host "📥 Sincronizzazione NAS → Local..." -ForegroundColor Yellow
    rsync -avz "$NasUser@$NasIp`:$NasPath/" "$LocalPath/"
    Write-Host "✅ Sincronizzazione NAS→Local completata!" -ForegroundColor Green
    Write-Host ""
}

if ($Direction -eq "push" -or $Direction -eq "both") {
    Write-Host "📤 Sincronizzazione Local → NAS..." -ForegroundColor Yellow
    rsync -avz "$LocalPath/" "$NasUser@$NasIp`:$NasPath/"
    Write-Host "✅ Sincronizzazione Local→NAS completata!" -ForegroundColor Green
}

Write-Host ""
Write-Host "📊 Statistiche finali:" -ForegroundColor Cyan
ssh "$NasUser@$NasIp" "du -sh $NasPath && echo '---' && ls -1 $NasPath/db-backup-*.sql | wc -l && echo 'backup trovati'"
```

**Uso:**
```powershell
# Scarica da NAS
.\Sync-Backups.ps1 -Direction pull

# Carica su NAS
.\Sync-Backups.ps1 -Direction push

# Sincronizza bidirezionale
.\Sync-Backups.ps1 -Direction both
```

---

## ✅ Metodo 5: API Web - Scarica tramite Browser

### 1️⃣ Web Interface Locale

```
http://localhost:5000/backup-management.html
```

**Funzioni disponibili**:
- 📋 Lista backup
- 📥 Scarica backup
- 📤 Carica backup
- 🔄 Sincronizza con NAS
- 🗑️ Elimina backup

### 2️⃣ API Endpoint Diretto

```
GET http://localhost:5000/api/backup/list
```

**Response:**
```json
{
  "success": true,
  "backups": [
    {
      "filename": "db-backup-2025-12-03T20-24-48-958Z.sql",
      "size": 2048000,
      "createdAt": "2025-12-03T20:24:48.958Z"
    }
  ]
}
```

### 3️⃣ Scarica backup tramite API

```bash
# Accedi direttamente dal browser:
http://localhost:5000/api/backup/download/db-backup-2025-12-03T20-24-48-958Z.sql
```

---

## 🔍 Comandi SSH Utili

### Vedi gli ultimi 10 backup

```bash
ssh vsc@192.168.1.248 "ls -lht /share/CACHEDEV1_DATA/molino/backups/db-backup-*.sql | head -10"
```

### Conta numero backup

```bash
ssh vsc@192.168.1.248 "ls -1 /share/CACHEDEV1_DATA/molino/backups/db-backup-*.sql | wc -l"
```

### Vedi dimensione totale

```bash
ssh vsc@192.168.1.248 "du -sh /share/CACHEDEV1_DATA/molino/backups"
```

### Rimuovi backup vecchio (>30 giorni)

```bash
ssh vsc@192.168.1.248 "find /share/CACHEDEV1_DATA/molino/backups -name 'db-backup-*.sql' -mtime +30 -delete"
```

### Verifica integrità backup

```bash
ssh vsc@192.168.1.248 "file /share/CACHEDEV1_DATA/molino/backups/db-backup-*.sql"
```

---

## 📊 Confronto Metodi

| Metodo | Semplicità | Velocità | Automatizzazione | Migliore Per |
|--------|-----------|----------|-----------------|-------------|
| **SSH** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Script/Automazione |
| **Web GUI** | ⭐⭐⭐ | ⭐⭐ | ⭐ | One-time download |
| **Network Drive** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | Esplorazione file |
| **API Web** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Applicazioni |
| **PowerShell Script** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Backup programmati |

---

## 🚀 Quick Start - Prima Volta

### Step 1: Test connessione SSH

```powershell
ssh vsc@192.168.1.248
```

Se funziona, vedi il prompt del NAS. Digita `exit` per uscire.

### Step 2: Vedi backup sul NAS

```powershell
ssh vsc@192.168.1.248 "ls -lh /share/CACHEDEV1_DATA/molino/backups"
```

### Step 3: Scarica ultimo backup

```powershell
# Lista ultimi 3
ssh vsc@192.168.1.248 "ls -1t /share/CACHEDEV1_DATA/molino/backups/db-backup-*.sql | head -3"

# Scarica il primo (più recente)
scp vsc@192.168.1.248:/share/CACHEDEV1_DATA/molino/backups/db-backup-2025-12-03T20-24-48-958Z.sql C:\Users\manue\Downloads\
```

### Step 4: Verifica download

```powershell
Get-Item C:\Users\manue\Downloads\db-backup-*.sql | Format-Table Name, @{N="Size(MB)";E={[math]::Round($_.Length/1MB,2)}}
```

---

## 🔒 Sicurezza

### Backup Password Encryption

```bash
# Se vuoi proteggere il backup con password (opzionale)
ssh vsc@192.168.1.248 << 'EOF'
cd /share/CACHEDEV1_DATA/molino/backups
gpg --symmetric db-backup-2025-12-03T20-24-48-958Z.sql
# Richiede password
EOF
```

### Chiave SSH (Evita password ogni volta)

```powershell
# Genera chiave SSH (se non hai già)
ssh-keygen -t rsa -b 4096 -f $env:USERPROFILE\.ssh\id_rsa

# Copia chiave pubblica su NAS
$pubKey = Get-Content $env:USERPROFILE\.ssh\id_rsa.pub
ssh vsc@192.168.1.248 "mkdir -p ~/.ssh && echo '$pubKey' >> ~/.ssh/authorized_keys"

# Ora puoi connetterti senza password
ssh vsc@192.168.1.248
```

---

## ✅ Checklist: Accesso Backup NAS

- [ ] Testato SSH: `ssh vsc@192.168.1.248`
- [ ] Visto lista backup: `ls -lh /share/CACHEDEV1_DATA/molino/backups`
- [ ] Scaricato almeno 1 backup
- [ ] Testato caricamento backup
- [ ] Configurato accesso Network Drive (opzionale)
- [ ] Testato API Web backup
- [ ] Salvato script PowerShell per automazione

---

## 🆘 Troubleshooting

### ❌ "Connection refused" o "Connection timeout"

```powershell
# Verifica che NAS sia raggiungibile
ping 192.168.1.248

# Se non raggiunge, controlla:
# 1. NAS è acceso?
# 2. Sei sulla stessa rete?
# 3. IP è corretto?
```

### ❌ "Permission denied" (SSH)

```bash
# Controlla permessi directory
ssh vsc@192.168.1.248 "ls -ld /share/CACHEDEV1_DATA/molino/backups"

# Se necessario, aggiusta permessi (come admin NAS)
ssh vsc@192.168.1.248 "sudo chmod 755 /share/CACHEDEV1_DATA/molino/backups"
```

### ❌ SCP non funziona

```powershell
# Assicurati che OpenSSH sia installato
Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH*' | Select-Object State

# Se non è installato:
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

### ❌ Network Drive non si monta

```powershell
# Verifica credenziali
net use \\192.168.1.248\molino-backups /user:vsc password /persistent:yes

# Se fallisce, prova con full path:
net use Z: \\192.168.1.248\share\CACHEDEV1_DATA\molino\backups /user:vsc password
```

---

## 📞 Contatti Supporto

```
📧 Email Admin NAS: (da contattare se problemi persistent)
📱 IP NAS: 192.168.1.248
🖥️  Admin Panel: http://192.168.1.248:8080
```

---

## 🎯 Prossimi Step

✅ **Completato**: Accesso manuale ai backup
⏭️ **Prossimo**: Configurare backup automatico programmato
⏭️ **Prossimo**: Testare restore dal backup
⏭️ **Prossimo**: Setup disaster recovery plan

