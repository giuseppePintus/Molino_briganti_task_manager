# Confronto Database: PostgreSQL vs MariaDB

**Data**: 20 Gennaio 2026  
**Contesto**: Scegliere database per migrazione da SQLite

---

## 📊 Opzioni Disponibili

### Opzione 1: PostgreSQL 15 (Docker Container)
### Opzione 2: MariaDB 10 (Package NAS QNAP o Docker)
### Opzione 3: MariaDB 5 (Package NAS QNAP - SCONSIGLIATO)

---

## 🔍 Analisi Dettagliata

### MariaDB 5.x (SCONSIGLIATO ❌)

**Versione**: ~5.5 (rilasciata 2010, EOL 2020)

**Contro**:
- ❌ **Obsoleta** - Fine supporto da 6 anni
- ❌ **Vulnerabilità** - Security issues non patchati
- ❌ **No JSON nativo** - Solo TEXT storage
- ❌ **Performance vecchie** - Ottimizzazioni del 2010
- ❌ **No CTEs** - Common Table Expressions non supportate
- ❌ **Prisma limited** - Supporto ridotto per versioni così vecchie

**Verdetto**: ❌ **NON USARE** - troppo vecchia e insicura

---

### MariaDB 10.x (OPZIONE VALIDA ✅)

**Versione Minima Consigliata**: 10.5+ (LTS: 10.6, 10.11)

#### Pro ✅
- ✅ **Package nativo QNAP** - Installazione semplice via App Center
- ✅ **Leggera** - ~150-200MB RAM (meno di PostgreSQL)
- ✅ **JSON support** - Tipo JSON nativo da 10.2+
- ✅ **Performance ottime** - Query cache, thread pool
- ✅ **Prisma support completo** - Provider "mysql" funziona perfettamente
- ✅ **Backup semplici** - `mysqldump` molto maturo
- ✅ **Compatibilità MySQL** - Migrazione facile se serve
- ✅ **Common Table Expressions** - CTEs da 10.2+
- ✅ **Window Functions** - Da 10.2+
- ✅ **InnoDB ottimizzato** - Crash recovery veloce

#### Contro ⚠️
- ⚠️ **JSON meno potente** - Non ai livelli di PostgreSQL (no JSONB)
- ⚠️ **Full-text search** - Meno flessibile di PostgreSQL
- ⚠️ **Extensions** - Ecosistema più limitato

#### Risorse
- **RAM**: 150-200MB (ottimo per NAS con 1.8GB liberi)
- **Disco**: ~300MB installazione + dati
- **CPU**: Basso impatto

#### Setup su QNAP
```bash
# Se disponibile via App Center
# 1. Aprire App Center nel pannello QNAP
# 2. Cercare "MariaDB 10"
# 3. Installare
# 4. Configurare via phpMyAdmin

# Oppure via Docker
docker run -d --name molino-mariadb \
  --restart unless-stopped \
  -e MYSQL_ROOT_PASSWORD=RootPass2026 \
  -e MYSQL_DATABASE=molino_production \
  -e MYSQL_USER=molino_user \
  -e MYSQL_PASSWORD=MolinoDB2026 \
  -v /share/Container/mariadb-data:/var/lib/mysql \
  -p 3306:3306 \
  mariadb:10.11
```

#### Prisma Schema
```prisma
datasource db {
  provider = "mysql"  // MariaDB usa provider "mysql"
  url      = env("DATABASE_URL")
}

// DATABASE_URL="mysql://molino_user:MolinoDB2026@localhost:3306/molino_production"
```

#### Feature per Inventario
```sql
-- JSON storage (MariaDB 10.2+)
CREATE TABLE pdf_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) UNIQUE,
  metadata JSON,  -- Supporto JSON nativo
  tags JSON,      -- Array di tags
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Query JSON
SELECT * FROM pdf_inventory 
WHERE JSON_CONTAINS(tags, '"articolo"');

-- Full-text search
ALTER TABLE pdf_inventory ADD FULLTEXT(title, description);
SELECT * FROM pdf_inventory 
WHERE MATCH(title, description) AGAINST('filtro');
```

---

### PostgreSQL 15 (OPZIONE PREMIUM ✅)

#### Pro ✅
- ✅ **JSONB nativo** - Storage binario velocissimo per JSON
- ✅ **Full-text search avanzato** - Multi-lingua, ranking, highlighting
- ✅ **Extensions potenti** - pg_trgm, PostGIS, etc
- ✅ **Standard SQL completo** - Compliance massima
- ✅ **ACID rigoroso** - Transazioni robustissime
- ✅ **Array nativi** - Tipo ARRAY per tags, etc
- ✅ **Prisma support eccellente** - Provider "postgresql"
- ✅ **Scalabilità** - Gestisce meglio carichi pesanti
- ✅ **Window functions avanzate** - Più potenti di MariaDB

#### Contro ⚠️
- ⚠️ **Più pesante** - ~250-300MB RAM vs 150-200MB MariaDB
- ⚠️ **Setup Docker only** - Non disponibile come app QNAP
- ⚠️ **Backup più lenti** - pg_dump più verboso di mysqldump
- ⚠️ **Configurazione più complessa** - Più parametri da ottimizzare

#### Risorse
- **RAM**: 250-300MB (comunque OK con 1.8GB liberi)
- **Disco**: ~500MB installazione + dati
- **CPU**: Leggermente più intenso

#### Setup su QNAP
```bash
# Solo Docker
docker run -d --name molino-postgres \
  --restart unless-stopped \
  -e POSTGRES_DB=molino_production \
  -e POSTGRES_USER=molino_user \
  -e POSTGRES_PASSWORD=MolinoDB2026 \
  -v /share/Container/postgres-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:15-alpine
```

#### Prisma Schema
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// DATABASE_URL="postgresql://molino_user:MolinoDB2026@localhost:5432/molino_production"
```

#### Feature per Inventario
```sql
-- JSONB storage (molto più veloce di JSON text)
CREATE TABLE pdf_inventory (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE,
  metadata JSONB,  -- JSONB binario indicizzabile
  tags TEXT[],     -- Array nativo PostgreSQL
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indice GIN su JSONB (ultra-veloce)
CREATE INDEX idx_metadata ON pdf_inventory USING GIN (metadata);
CREATE INDEX idx_tags ON pdf_inventory USING GIN (tags);

-- Query JSON avanzate
SELECT * FROM pdf_inventory 
WHERE metadata @> '{"category": "articoli"}';

SELECT * FROM pdf_inventory 
WHERE 'filtro' = ANY(tags);

-- Full-text search multi-lingua
ALTER TABLE pdf_inventory 
ADD COLUMN search_vector tsvector;

CREATE INDEX idx_search ON pdf_inventory USING GIN(search_vector);

SELECT * FROM pdf_inventory 
WHERE search_vector @@ to_tsquery('italian', 'aspirazione & polveri');
```

---

## 🎯 Confronto Diretto

| Feature | PostgreSQL 15 | MariaDB 10.11 | MariaDB 5 |
|---------|--------------|---------------|-----------|
| **Rilascio** | 2022 | 2023 (LTS) | 2010 ❌ |
| **Supporto** | Attivo fino 2027 | Attivo fino 2028 | EOL 2020 ❌ |
| **RAM richiesta** | 250-300MB | 150-200MB ✅ | 100-150MB |
| **JSON nativo** | ✅ JSONB | ✅ JSON | ❌ Solo TEXT |
| **Array nativi** | ✅ Tipo ARRAY | ⚠️ JSON array | ❌ No |
| **Full-text search** | ✅✅ Eccellente | ✅ Buono | ⚠️ Basilare |
| **Prisma support** | ✅✅ Ottimo | ✅ Ottimo | ⚠️ Limitato |
| **Window functions** | ✅✅ Complete | ✅ Da 10.2+ | ❌ No |
| **CTEs (WITH)** | ✅✅ Complete | ✅ Da 10.2+ | ❌ No |
| **Setup QNAP** | Docker only | App Center o Docker ✅ | App Center |
| **Backup tool** | pg_dump | mysqldump ✅ | mysqldump |
| **Backup speed** | Medio | Veloce ✅ | Veloce |
| **Restore speed** | Medio | Veloce ✅ | Veloce |
| **Performance** | ✅✅ Eccellente | ✅✅ Eccellente | ⚠️ Vecchia |
| **Scalabilità** | ✅✅ Ottima | ✅ Buona | ⚠️ Limitata |
| **Security patches** | ✅ Attivi | ✅ Attivi | ❌ Nessuno |

---

## 🏆 Raccomandazione Finale

### **VINCITORE: MariaDB 10.11 LTS** ✅✅✅

#### Perché MariaDB 10 invece di PostgreSQL?

1. **Setup più semplice** - Se disponibile come App QNAP nativa
2. **Più leggera** - 150-200MB vs 250-300MB RAM
3. **Backup più veloci** - mysqldump è più rapido di pg_dump
4. **Feature sufficienti** - JSON nativo, CTEs, Window functions
5. **Meno overkill** - PostgreSQL è "troppo" per questa app
6. **Familiarità** - MySQL/MariaDB più comune e documentato

#### Quando preferire PostgreSQL?

- 🔍 Se serve **full-text search multilingua avanzato**
- 📊 Se hai **query JSON molto complesse** (JSONB indicizzato)
- 🚀 Se prevedi **migliaia di utenti concorrenti**
- 🔧 Se servono **extensions specializzate** (PostGIS, etc)

**Per questa applicazione**: MariaDB 10 è **più che sufficiente** e più pratica.

---

## 📋 Piano Aggiornato con MariaDB 10

### FASE 1: Verificare Versione MariaDB Disponibile

```bash
# Controllare App Center QNAP
ssh admin@192.168.1.248 "
  ls -la /share/CACHEDEV1_DATA/.qpkg/ | grep -i maria
"

# Se MariaDB 10 è disponibile via App Center -> INSTALLARE DA LÌ
# Altrimenti -> Usare Docker (come sotto)
```

### FASE 2: Installazione MariaDB 10.11

#### Opzione A: Via App Center QNAP (PREFERITA)
1. Aprire pannello QNAP (http://192.168.1.248:8080)
2. App Center → Cerca "MariaDB 10"
3. Installa e configura password root
4. Accesso via phpMyAdmin

#### Opzione B: Via Docker
```bash
ssh admin@192.168.1.248 "
  mkdir -p /share/Container/mariadb-data
  mkdir -p /share/Container/backups/mariadb

  /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker run -d \
    --name molino-mariadb \
    --restart unless-stopped \
    -e MYSQL_ROOT_PASSWORD=RootPass2026Secure \
    -e MYSQL_DATABASE=molino_production \
    -e MYSQL_USER=molino_user \
    -e MYSQL_PASSWORD=MolinoDB2026Secure \
    -v /share/Container/mariadb-data:/var/lib/mysql \
    -p 3306:3306 \
    mariadb:10.11
"
```

### FASE 3: Aggiornare Prisma Schema

```prisma
datasource db {
  provider = "mysql"  // MariaDB usa provider mysql
  url      = env("DATABASE_URL")
}

// Aggiungere tabella inventario
model PdfInventory {
  id          Int      @id @default(autoincrement())
  filename    String   @unique @db.VarChar(255)
  category    String   @db.VarChar(100)
  title       String   @db.VarChar(500)
  description String?  @db.Text
  uploadedAt  DateTime @default(now())
  updatedAt   DateTime @updatedAt
  filePath    String   @db.VarChar(1000)
  fileSize    Int
  metadata    Json?    // MariaDB 10+ supporta JSON
  tags        Json?    // Stored as JSON array
  
  @@index([category])
  @@index([uploadedAt])
  @@fulltext([title, description])  // Full-text search
}
```

### FASE 4: Environment Variables

```env
# MariaDB Connection
DATABASE_URL="mysql://molino_user:MolinoDB2026Secure@192.168.1.248:3306/molino_production"
```

### FASE 5: Backup Automatico MariaDB

```bash
# Script backup (più semplice di PostgreSQL)
ssh admin@192.168.1.248 "
  docker run -d --name mariadb-backup \
    --restart unless-stopped \
    --network container:molino-mariadb \
    -v /share/Container/backups/mariadb:/backups \
    -e MYSQL_HOST=localhost \
    -e MYSQL_USER=root \
    -e MYSQL_PASSWORD=RootPass2026Secure \
    mariadb:10.11 \
    sh -c 'while true; do \
      mysqldump -h localhost -u root -pRootPass2026Secure molino_production > /backups/backup-\$(date +%Y%m%d-%H%M%S).sql; \
      find /backups -name \"backup-*.sql\" -mtime +30 -delete; \
      sleep 3600; \
    done'
"
```

---

## ✅ Vantaggi MariaDB 10 per il Tuo Caso

1. ✅ **Setup rapido** - 15 minuti se via App Center
2. ✅ **Più leggera** - Lascia più RAM per l'app
3. ✅ **Backup veloci** - mysqldump è molto efficiente
4. ✅ **Feature moderne** - JSON, CTEs, Window functions sufficienti
5. ✅ **Tool familiari** - phpMyAdmin, MySQL Workbench
6. ✅ **Documentazione ampia** - Più tutorial e guide disponibili

---

## 🚀 Prossimo Step

**Verifica quale MariaDB è disponibile sul NAS**:
```bash
ssh admin@192.168.1.248 "ls -la /share/CACHEDEV1_DATA/.qpkg/ | grep -i maria"
```

Se trovi **MariaDB 10**, procediamo con quella.  
Se trovi solo **MariaDB 5**, usiamo **Docker con MariaDB 10.11**.

**IMPORTANTE**: ❌ **NON USARE MariaDB 5** - troppo vecchia e insicura.
