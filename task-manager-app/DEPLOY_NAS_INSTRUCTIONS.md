# Deploy Task Manager su NAS Reale

## Build Status
- **Date**: 30 Nov 2025, 23:12
- **Package**: `build-nas-20251130-2312.zip`
- **Size**: 3.58 MB
- **Contents**: Server dist files, public assets, config files

## Credenziali NAS
```
IP: 192.168.1.248
User: vsc
Password: vsc12345
Port: 22
```

## Metodo 1: Caricamento Automatico (CONSIGLIATO)

### Prerequisiti
- WinSCP installato (https://winscp.net/eng/download.php)
- SSH accesso disponibile

### Procedura

1. **Apri WinSCP** e crea una nuova connessione:
   - File -> New Session
   - Host: `192.168.1.248`
   - Port: `22`
   - Username: `vsc`
   - Password: `vsc12345`
   - Click "Login"

2. **Naviga a** `/home/vsc/`

3. **Carica il file**:
   - Drag & drop: `build-nas-20251130-2312.zip`
   - Oppure: Upload (Ctrl+Up)

4. **Verifica il caricamento**: il file deve apparire in `/home/vsc/`

## Metodo 2: Caricamento via SSH/SCP (da terminale Linux/Mac)

```bash
scp build-nas-20251130-2312.zip vsc@192.168.1.248:/home/vsc/
```

## Setup sul NAS (dopo caricamento)

Una volta caricato il file su `/home/vsc/`, connettiti al NAS e esegui:

```bash
# Accedi al NAS
ssh vsc@192.168.1.248

# Naviga alla home
cd /home/vsc

# Decomprimi il build
unzip build-nas-20251130-2312.zip

# Entra nella directory
cd build-nas-20251130-2312

# Installa dipendenze Node.js
npm install

# Avvia il server
npm start
```

## Controllo Servizio

### Status del server
```bash
# Connessione SSH
ssh vsc@192.168.1.248

# Verifica processo
ps aux | grep node

# Verifica porta 5000
netstat -tuln | grep 5000
```

### URL di accesso
- **Web UI**: http://192.168.1.248:5000
- **API**: http://192.168.1.248:5000/api

### Credenziali predefinite
- **Username**: Manuel
- **Password**: 123

## Backup Automatici

I backup saranno creati in:
```
/home/vsc/backups/
```

Per verificare i backup:
```bash
ls -la /home/vsc/backups/
```

## Troubleshooting

### Il file zip e' corrotto
```bash
unzip -t build-nas-20251130-2312.zip
```

### Porta 5000 gia in uso
```bash
# Uccidi il processo precedente
pkill -f "node server/dist/index.js"
```

### Permessi insufficienti
```bash
chmod -R 755 build-nas-20251130-2312/
```

## Contenuto del Build

```
build-nas-20251130-2312/
├── server/
│   └── dist/           (File JavaScript compilati)
│       ├── index.js
│       ├── controllers/
│       ├── routes/
│       ├── middleware/
│       └── services/
├── public/             (Static assets)
│   ├── index.html
│   ├── admin-dashboard.html
│   ├── orders-planner.html
│   ├── css/
│   ├── js/
│   └── data/
├── package.json
├── tsconfig.json
├── docker-compose.yml
└── Dockerfile
```

## Note Importanti

- Il database SQLite si creerà automaticamente in `server/prisma/data/tasks.db`
- I backup incrementali verranno salvati su NAS ogni 60 minuti
- Il server richiede Node.js 18+ (verificare con `node --version`)
- La porta 5000 deve essere disponibile

## Rollback

Se c'e' un problema, puoi eliminare tutto e ricominciare:

```bash
cd /home/vsc
rm -rf build-nas-20251130-2312/
unzip build-nas-20251130-2312.zip
cd build-nas-20251130-2312
npm install
npm start
```

---

**Build Date**: 30 Nov 2025, 23:12
**Package**: build-nas-20251130-2312.zip
**Status**: Ready for deployment
