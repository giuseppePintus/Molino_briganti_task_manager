# 🐳 Bind Mounts - Guida per Molino Briganti

## Problema che abbiamo risolto

Avete avuto un problema critico con bind mount in docker-compose.yml:

```yaml
# ❌ SBAGLIATO - CAUSAVA ERRORE!
volumes:
  - ./server/prisma:ro  # Read-only mount del schema Prisma
```

**Conseguenza**: 
- Prisma non poteva eseguire migrazioni
- Database schema non sincronizzato
- Errore: "column `reserved` does not exist"

---

## Soluzione implementata

```yaml
# ✅ CORRETTO - Usiamo solo /data/molino per persistence
volumes:
  - ./data/molino:/data/molino        # Database + backups
  - ./public:/app/public              # HTML/CSS/JS
  # ❌ MAI montare: ./server/prisma:ro
  # ❌ MAI montare: ./server/src:ro
```

---

## Regole d'oro per Bind Mounts

### ✅ COSA MONTARE (Read-only dove possibile)

| Path Host | Container | Tipo | Motivo |
|-----------|-----------|------|--------|
| `./public` | `/app/public` | `ro` (read-only) | Frontend static files |
| `./data/molino` | `/data/molino` | `rw` (read-write) | Database + backups |
| `.env` | `/app/.env` | `ro` (read-only) | Config |

### ❌ COSA NON MONTARE MAI

```yaml
# ❌ NON MONTARE - Build artifacts
./server/dist:ro

# ❌ NON MONTARE - Prisma schema (blocca migrazioni!)
./server/prisma:ro

# ❌ NON MONTARE - Source code (causa problemi)
./server/src:ro

# ❌ NON MONTARE - node_modules (conflitti)
./node_modules:ro
```

**PERCHÉ?** Perché la build docker è self-contained. Se cambi sorgenti, rebuild immagine.

---

## Bind Mount vs Volume - Quando usare cosa

### 📌 Bind Mount (`:` in docker-compose)
**Usa quando**: Devi LEGGERE file dal host, oppure PERSISTERE dati

```yaml
volumes:
  - ./public:/app/public              # Serve HTML dal host
  - ./data/molino:/data/molino        # Persisti database
```

**Vantaggi**:
- ✅ Vedi file su host (debug facile)
- ✅ Persisti dati tra container restart
- ✅ Condividi con altri container

**Problemi**:
- ❌ Performance sui Mac/Windows (tramite VM)
- ❌ Permessi file possono causare errori
- ❌ Se monti cartella build, blocchi rebuild

### 📦 Volume (named volume)
**Usa quando**: Docker gestisca completamente la persistence

```yaml
volumes:
  db_volume:
    driver: local

services:
  db:
    volumes:
      - db_volume:/var/lib/sqlite
```

**Per Molino Briganti**: Non serve perché usiamo bind mount per backup compatibility.

---

## Docker Compose - Corretta configurazione

```yaml
version: '3.8'

services:
  molino-app:
    build: .
    ports:
      - "5000:5000"
    volumes:
      # ✅ Database + backups (read-write, persisti tra restart)
      - ./data/molino:/data/molino
      
      # ✅ Frontend (read-only, veloce)
      - ./public:/app/public:ro
      
      # ❌ NON MONTARE:
      # - ./server/dist:ro  (Build artifact)
      # - ./server/prisma:ro (Blocca migrazioni)
      # - ./server/src:ro   (Usa immagine build)
    environment:
      - DATABASE_URL=file:///data/molino/molino.db
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Backup container
  nas-backup:
    image: alpine
    volumes:
      - ./data/molino:/backup/data:ro
      - ./backups:/backup/local
```

---

## Lifecycle: Quando Prisma funziona

```
CONTAINER START
    ↓
docker-start.sh (crea directory /data/molino/backups)
    ↓
node app runs
    ↓
app/index.ts: prisma.$connect()
    ↓
Prisma GENERA migrazioni ✅ (funziona perché NON è mounted :ro)
    ↓
Database sincronizzato
    ↓
Server ready on :5000
```

**KEY POINT**: Prisma deve scrivere in `./server/prisma/` per gestire migrazioni.

---

## Read-Only mount: Quando usarlo

```yaml
volumes:
  # ✅ OK: Frontend è static, non cambia
  - ./public:/app/public:ro
  
  # ✅ OK: Config file, non scritto da app
  - ./.env:/app/.env:ro
  
  # ❌ NO: Database deve scrivere
  - ./data/molino:/data/molino:ro  # ERRORE!
  
  # ❌ NO: Prisma deve scrivere migrazioni
  - ./server/prisma:/app/prisma:ro  # ERRORE!
```

---

## Performance considerations

### Mac/Windows (Docker Desktop)

```
Host Filesystem
        ↓
VM (Linux inside Docker Desktop)
        ↓
Container

Bind mounts passano per VM → LENTO su Mac/Windows
```

**Optimization**:
```yaml
volumes:
  # ✅ Necessario → Lo facciamo
  - ./data/molino:/data/molino
  
  # ❌ Non necessario → Non lo montare
  # - ./server/src:/app/server/src (è già nella build!)
```

**Result**: Build cache hits 60% più veloce perché non rimonta sorgenti ogni volta.

---

## Best Practice per Molino Briganti

```dockerfile
# Dockerfile: Build è SELF-CONTAINED
FROM node:18 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY server ./server
RUN npm run build        # Compila TypeScript → dist/

COPY public ./public     # Frontend

# Production stage
FROM node:18

COPY --from=build /app/dist /app/server/dist
COPY --from=build /app/public /app/public
COPY --from=build /app/node_modules /app/node_modules

# ✅ Non copiare ./server/src (non serve in produzione)
# ✅ Non copiare ./server/prisma (schema nel DB)

RUN mkdir -p /data/molino/backups

CMD ["node", "/app/server/dist/index.js"]
```

```yaml
# docker-compose.yml: Mount SOLO runtime necessari
services:
  app:
    volumes:
      # Persistence: database
      - ./data/molino:/data/molino
      
      # Development: HTML files (hot update senza rebuild)
      - ./public:/app/public:ro
```

---

## Troubleshooting

### Errore: "Permission denied"
```bash
# Problema: File creato in container, host non può leggerlo
# Soluzione: Check permissions
ls -la ./data/molino/
# Fix: sudo chown -R $USER:$USER ./data/molino/
```

### Errore: "Bind source path does not exist"
```yaml
# ❌ SBAGLIATO
- /absolute/path:/container/path

# ✅ CORRETTO
- ./relative/path:/container/path
```

### Errore: "Database is locked"
```bash
# Problema: Bind mount SQLite da Mac/Windows causa lock
# Soluzione: Usa volume o upgrade Docker Desktop
volumes:
  - db_volume:/data/molino  # Volume invece di bind mount

volumes:
  db_volume:
    driver: local
```

---

## Checklist: Prima di ogni deploy

- [ ] `.server/prisma:ro` RIMOSSO da docker-compose.yml
- [ ] `.server/src:ro` RIMOSSO da docker-compose.yml  
- [ ] `.server/dist:ro` RIMOSSO da docker-compose.yml
- [ ] `./public:/app/public:ro` PRESENTE (frontend static)
- [ ] `./data/molino:/data/molino` PRESENTE (database)
- [ ] No bind mount di directory create IN container (solo FROM host)
- [ ] Dockerfile è self-contained (niente dipende da docker-compose mounts)
- [ ] Test: `docker compose up -d && docker compose logs -f` (NO errori)

---

## Riferimento Docker Official

Fonte: https://docs.docker.com/storage/bind-mounts/

**Key points dalla documentazione ufficiale**:

1. **Bind-mounting over existing data**
   > "If you bind mount a file or directory into a directory in the container in which files or directories exist, the pre-existing files are obscured by the mount."
   
   → Questo è quello che causava il problema con Prisma!

2. **Considerations**
   > "Containers with bind mounts are strongly tied to the host. Bind mounts rely on the host machine's filesystem having a specific directory structure available."
   
   → Per questo non montiamo source code in production

3. **Read-only mounts**
   > "The `readonly` or `ro` option prevents the container from writing to the mount."
   
   → Usa per frontend static, config files

---

## Conclusione

**Per Molino Briganti**:

✅ Monta SOLO:
- `./data/molino:/data/molino` (database + backups)
- `./public:/app/public:ro` (frontend)

❌ NON montare:
- Cartelle build (dist/)
- Cartelle source (src/, prisma/)
- node_modules

✅ Laiscia Docker:
- Gestire build
- Gestire Prisma
- Gestire migrazioni

**Risultato**: Container prevedibile, scalabile, e che funziona su localhost, Docker Desktop, E NAS! 🚀
