# Deploy Manuale Docker su NAS

Poiché il caricamento automatico ha problemi con i path su Windows/PowerShell, usa questo metodo manuale:

## Step 1: Apri WinSCP

Scarica WinSCP da: https://winscp.net/download/WinSCP-6.3.6-Setup.exe

## Step 2: Connessione al NAS

- **Host**: 192.168.1.248
- **Port**: 22
- **Username**: vsc
- **Password**: vsc12345
- **Protocollo**: SFTP

Clicca "Login"

## Step 3: Naviga a Home Directory

Il path di home di `vsc` è: `/share/homes/vsc`

(Dovrebbe aprirsi automaticamente)

## Step 4: Crea directory di lavoro

Clicca tasto destro → "Create Folder" → nome: `molino-app`

Doppio-click per entrare in `molino-app`

## Step 5: Carica i file

### Metodo A: Carica il build-nas-clean.zip (Consigliato)

1. Nel PC, naviga a: `C:\Users\manue\Molino_briganti_task_manager\task-manager-app\`
2. Seleziona il file: `build-nas-clean.zip`
3. In WinSCP, Drag & Drop il file in `molino-app/` oppure premi Ctrl+Up
4. Attendi il caricamento (~30 secondi)

### Metodo B: Carica i file singolarmente

Se preferisci, carica direttamente:
- `server/dist/*` → `molino-app/server/dist/`
- `public/*` → `molino-app/public/`
- `package.json` → `molino-app/`
- `docker-compose.yml` → `molino-app/`
- `Dockerfile` → `molino-app/`

## Step 6: Estrai il file zip (se usi metodo A)

Nella terminal WinSCP:

```bash
cd ~/molino-app
unzip build-nas-clean.zip
mv build-nas-clean/* .
rmdir build-nas-clean
```

## Step 7: Verifica la struttura

```bash
ls -la ~/molino-app
```

Dovrebbe mostrare:
- `server/` (directory)
- `public/` (directory)
- `package.json`
- `docker-compose.yml`
- `Dockerfile`

## Step 8: Prepara il data directory

```bash
mkdir -p /share/CACHEDEV1_DATA/molino/backups
chmod -R 777 /share/CACHEDEV1_DATA/molino
```

## Step 9: Avvia Docker

```bash
cd ~/molino-app
docker-compose up -d --build
```

Questo processo (build + avvio) impiega 3-5 minuti.

## Step 10: Verifica

```bash
docker ps
docker logs molino-briganti-task-manager
```

## Accesso Web

Dopo 1-2 minuti:
- **URL**: http://192.168.1.248:5000
- **Username**: Manuel
- **Password**: 123

## Comandi utili

### Verifica status
```bash
docker ps
docker logs molino-briganti-task-manager -f
```

### Stop container
```bash
cd ~/molino-app
docker-compose down
```

### Riavvia container
```bash
cd ~/molino-app
docker-compose up -d
```

### Pulisci e riavvia da zero
```bash
cd ~/molino-app
docker-compose down
docker system prune -a
docker-compose up -d --build
```

---

Se hai problemi, contattami!
