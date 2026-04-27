# nas-config.example.sh
# Copia questo file in `nas-config.local.sh` (gitignored) e popolalo con le credenziali reali.
#   cp nas-config.example.sh nas-config.local.sh
# Poi negli script .sh usa:
#   source "$(dirname "$0")/../nas-config.local.sh"

export NAS_IP="192.168.1.248"
export NAS_HOST="NAS71F89C"
export NAS_USER="admin"
export NAS_PASSWORD="<INSERISCI_PASSWORD_NAS>"
export NAS_DOCKER="/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker"

export NAS_CONTAINER="molino-task-manager-nas"

export DB_HOST="127.0.0.1"
export DB_PORT="3306"
export DB_NAME="molino_production"
export DB_USER="molino_user"
export DB_PASSWORD="<INSERISCI_PASSWORD_DB>"

export JWT_SECRET="<INSERISCI_JWT_SECRET>"
