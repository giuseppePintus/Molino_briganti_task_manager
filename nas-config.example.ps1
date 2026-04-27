# nas-config.example.ps1
# COPIA QUESTO FILE in `nas-config.local.ps1` (gitignored) e popolalo con le credenziali reali.
# Poi tutti gli script PS1 lo caricheranno automaticamente.
#
# In Windows: Copy-Item .\nas-config.example.ps1 .\nas-config.local.ps1
# Poi modifica nas-config.local.ps1 sostituendo i placeholder.
#
# IMPORTANTE: nas-config.local.ps1 NON deve mai essere committato (vedi .gitignore).

# --- NAS QNAP ---
$Global:NAS_IP       = "192.168.1.248"
$Global:NAS_HOST     = "NAS71F89C"
$Global:NAS_USER     = "admin"
$Global:NAS_PASSWORD = "<INSERISCI_PASSWORD_NAS>"
$Global:NAS_DOCKER   = "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker"

# --- Container ---
$Global:NAS_CONTAINER = "molino-task-manager-nas"

# --- MariaDB ---
$Global:DB_HOST     = "127.0.0.1"
$Global:DB_PORT     = 3306
$Global:DB_NAME     = "molino_production"
$Global:DB_USER     = "molino_user"
$Global:DB_PASSWORD = "<INSERISCI_PASSWORD_DB>"

# --- App ---
$Global:JWT_SECRET = "<INSERISCI_JWT_SECRET>"
