# Piano Migrazione Database Esterno

**Data**: 20 Gennaio 2026  
**Obiettivo**: Migrare da SQLite locale a PostgreSQL centralizzato su NAS

---

## 📊 Analisi Situazione Attuale

### Problemi Identificati
1. **SQLite non condivisibile** - Database locale non accessibile da altre app
2. **Backup frammentato** - Sistema backup complesso e problematico
3. **Inventario PDF isolato** - Non accessibile da altre applicazioni
4. **Errori NAS backup server** - Container tentava connessione a server inesistente
5. **Crash frequenti** - Exit 137 (OOM) probabilmente causato da backup intensivi

### Database Attuale
- **Tipo**: SQLite (`tasks.db`)
- **Posizione**: `/share/Container/data/molino/tasks.db`
- **Size**: ~pochi MB
- **Tabelle principali**: User, Task, Order, Trip, Customer, Article, Company, TaskNote

---

## 🎯 Architettura Proposta

### Opzioni Database

#### Opzione 1: PostgreSQL (RACCOMANDATO ✅)
**Pro**:
- ✅ Standard enterprise-grade
- ✅ Supporto JSON nativo (utile per inventario)
- ✅ Ottime performance con concorrenza
- ✅ Backup robusti con `pg_dump`
- ✅ Prisma supporta completamente PostgreSQL
- ✅ Connessioni multiple simultanee
- ✅ Full-text search nativo

**Contro**:
- Richiede ~200MB RAM (accettabile con 1.8GB disponibili)
- Setup leggermente più complesso

**Risorse NAS**:
- RAM richiesta: ~200-300MB
- Disco: ~500MB per installazione + dati
- **VERDETTO**: ✅ Fattibile

#### Opzione 2: MySQL/MariaDB
**Pro**:
- Molto diffuso
- Prisma supporta bene

**Contro**:
- Meno feature avanzate di PostgreSQL
- Non aggiunge vantaggi rispetto a PostgreSQL

#### Opzione 3: MongoDB
**Pro**:
- NoSQL, flessibile per inventario

**Contro**:
- ❌ Richiede riscrittura schema Prisma completa
- ❌ Più RAM di PostgreSQL
- ❌ Overkill per questa applicazione

---

## 🏗️ Architettura Finale Proposta

```
┌─────────────────────────────────────────────────────────────┐
│                     NAS QNAP (192.168.1.248)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Container (porta 5432)                     │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│  │                                                         │ │
│  │  Database: molino_production                          │ │
│  │  ├── Schema: public                                   │ │
│  │  │   ├── User, Task, Order, Trip, Customer           │ │
│  │  │   ├── Article, Company, TaskNote                  │ │
│  │  │   └── PdfInventory (NUOVO)                        │ │
│  │  │                                                     │ │
│  │  ├── Volume: /var/lib/postgresql/data                │ │
│  │  │   → /share/Container/postgres-data                │ │
│  │  │                                                     │ │
│  │  └── Backup automatico: pg_dump ogni ora             │ │
│  │      → /share/Container/backups/postgres/             │ │
│  └────────────────────────────────────────────────────────┘ │
│                              ▲                                │
│                              │ PostgreSQL Protocol             │
│                              │ (porta 5432)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Molino App Container (porta 5000)                     │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│  │                                                         │ │
│  │  DATABASE_URL=postgresql://user:pass@postgres:5432/db │ │
│  │                                                         │ │
│  │  API Endpoints:                                        │ │
│  │  - /api/tasks, /api/orders (Prisma → PostgreSQL)     │ │
│  │  - /api/inventory (NUOVO - accesso centralizzato)    │ │
│  │  - /api/backup (gestione backup PostgreSQL)          │ │
│  └────────────────────────────────────────────────────────┘ │
│                              ▲                                │
└──────────────────────────────┼────────────────────────────────┘
                               │ HTTP/REST API
                               │
                    ┌──────────┴──────────┐
                    │                     │
            ┌───────▼───────┐    ┌───────▼──────┐
            │  Web Browser  │    │ Future Apps  │
            │  (Dashboard)  │    │ (Mobile/etc) │
            └───────────────┘    └──────────────┘
```

---

## 📋 Piano di Implementazione

### FASE 1: Setup PostgreSQL Container (1-2 ore)

#### 1.1 Creare PostgreSQL Container
```bash
ssh admin@192.168.1.248 "
  mkdir -p /share/Container/postgres-data
  mkdir -p /share/Container/backups/postgres

  /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker run -d \
    --name molino-postgres \
    --restart unless-stopped \
    -e POSTGRES_DB=molino_production \
    -e POSTGRES_USER=molino_user \
    -e POSTGRES_PASSWORD=MolinoDB2026SecurePass \
    -v /share/Container/postgres-data:/var/lib/postgresql/data \
    -p 5432:5432 \
    postgres:15-alpine
"
```

#### 1.2 Verificare Connessione
```bash
ssh admin@192.168.1.248 "
  /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker exec -it molino-postgres \
    psql -U molino_user -d molino_production -c '\dt'
"
```

### FASE 2: Aggiornare Schema Prisma (30 min)

#### 2.1 Modificare `schema.prisma`
```prisma
datasource db {
  provider = "postgresql"  // ← Cambiato da "sqlite"
  url      = env("DATABASE_URL")
}
```

#### 2.2 Aggiungere Tabella Inventario
```prisma
model PdfInventory {
  id          Int      @id @default(autoincrement())
  filename    String   @unique
  category    String   // "articoli" | "clienti" | "fornitori" | "altro"
  title       String
  description String?
  uploadedAt  DateTime @default(now())
  updatedAt   DateTime @updatedAt
  filePath    String   // Path relativo nel filesystem
  fileSize    Int      // Bytes
  metadata    Json?    // Dati estratti dal PDF
  tags        String[] // Array di tags per ricerca
}
```

#### 2.3 Aggiornare DATABASE_URL
```env
# Vecchio (SQLite)
DATABASE_URL="file:/share/Container/data/molino/tasks.db"

# Nuovo (PostgreSQL)
DATABASE_URL="postgresql://molino_user:MolinoDB2026SecurePass@molino-postgres:5432/molino_production?schema=public"
```

### FASE 3: Migrazione Dati (1 ora)

#### 3.1 Export da SQLite
```bash
# Script di export dati
cd task-manager-app
npm run export-sqlite-data
# Output: migration-data.json
```

#### 3.2 Prisma Migrate
```bash
npx prisma migrate dev --name init_postgresql
npx prisma generate
```

#### 3.3 Import in PostgreSQL
```bash
npm run import-migration-data
```

### FASE 4: Aggiornare Docker Compose (30 min)

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: molino-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=molino_production
      - POSTGRES_USER=molino_user
      - POSTGRES_PASSWORD=MolinoDB2026SecurePass
    volumes:
      - /share/Container/postgres-data:/var/lib/postgresql/data
      - /share/Container/backups/postgres:/backups
    ports:
      - "5432:5432"
    networks:
      - molino-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U molino_user -d molino_production"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Applicazione principale
  molino-app:
    build: .
    container_name: molino-app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://molino_user:MolinoDB2026SecurePass@postgres:5432/molino_production?schema=public
      - PORT=5000
    volumes:
      - /share/Container/data/molino/uploads:/app/uploads
    ports:
      - "5000:5000"
    networks:
      - molino-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Backup automatico PostgreSQL
  postgres-backup:
    image: postgres:15-alpine
    container_name: molino-postgres-backup
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_DB=molino_production
      - POSTGRES_USER=molino_user
      - POSTGRES_PASSWORD=MolinoDB2026SecurePass
      - BACKUP_DIR=/backups
      - BACKUP_KEEP_DAYS=30
    volumes:
      - /share/Container/backups/postgres:/backups
    networks:
      - molino-network
    entrypoint: |
      sh -c '
        while true; do
          echo "🔄 Starting backup at $$(date)"
          pg_dump -h postgres -U molino_user molino_production > /backups/backup-$$(date +%Y%m%d-%H%M%S).sql
          echo "✅ Backup completed"
          
          # Rimuovi backup vecchi (> 30 giorni)
          find /backups -name "backup-*.sql" -mtime +30 -delete
          
          # Aspetta 1 ora
          sleep 3600
        done
      '

networks:
  molino-network:
    driver: bridge
```

### FASE 5: API Inventario Condiviso (2 ore)

#### 5.1 Creare Service Inventario
```typescript
// server/src/services/inventoryService.ts
import { PrismaClient } from '@prisma/client';

export class InventoryService {
  constructor(private prisma: PrismaClient) {}

  async uploadPdf(file: Express.Multer.File, metadata: any) {
    return await this.prisma.pdfInventory.create({
      data: {
        filename: file.filename,
        category: metadata.category,
        title: metadata.title,
        filePath: file.path,
        fileSize: file.size,
        tags: metadata.tags || [],
      }
    });
  }

  async searchInventory(query: string, category?: string) {
    return await this.prisma.pdfInventory.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { has: query } }
        ],
        ...(category && { category })
      },
      orderBy: { uploadedAt: 'desc' }
    });
  }

  async getAllByCategory(category: string) {
    return await this.prisma.pdfInventory.findMany({
      where: { category },
      orderBy: { title: 'asc' }
    });
  }
}
```

#### 5.2 API Endpoints
```typescript
// GET /api/inventory - Lista completa
// GET /api/inventory/search?q=articolo&category=articoli
// GET /api/inventory/:id - Dettaglio singolo
// POST /api/inventory - Upload nuovo PDF
// PUT /api/inventory/:id - Aggiorna metadata
// DELETE /api/inventory/:id - Elimina
```

### FASE 6: Testing e Deploy (2 ore)

#### 6.1 Test Locale
```bash
# Test connessione PostgreSQL
npm run test:db-connection

# Test migrazione dati
npm run test:migration

# Test API inventario
npm run test:inventory-api
```

#### 6.2 Deploy su NAS
```bash
cd task-manager-app
npm run build

# Deploy completo con nuovo docker-compose
./deploy-postgres-migration.sh
```

---

## 🔧 Comandi Utili Post-Migrazione

### Backup Manuale PostgreSQL
```bash
ssh admin@192.168.1.248 "
  docker exec molino-postgres pg_dump -U molino_user molino_production > /share/Container/backups/postgres/manual-backup-$(date +%Y%m%d).sql
"
```

### Restore da Backup
```bash
ssh admin@192.168.1.248 "
  docker exec -i molino-postgres psql -U molino_user molino_production < /share/Container/backups/postgres/backup-YYYYMMDD-HHMMSS.sql
"
```

### Verifica Dimensione Database
```bash
ssh admin@192.168.1.248 "
  docker exec molino-postgres psql -U molino_user -d molino_production -c '\l+'
"
```

### Connessione Diretta PostgreSQL
```bash
ssh admin@192.168.1.248 "
  docker exec -it molino-postgres psql -U molino_user -d molino_production
"
```

---

## ⚠️ Rischi e Mitigazioni

### Rischio 1: Perdita Dati Durante Migrazione
**Mitigazione**:
- ✅ Backup completo SQLite prima di iniziare
- ✅ Test migrazione su copia locale
- ✅ Verifica integrità dati post-migrazione
- ✅ Mantenere SQLite come fallback per 1 settimana

### Rischio 2: Performance PostgreSQL su NAS
**Mitigazione**:
- ✅ PostgreSQL Alpine è leggero (~200MB RAM)
- ✅ NAS ha 1.8GB RAM disponibili
- ✅ Configurare `shared_buffers` e `work_mem` ottimali
- ✅ Monitoring con `pg_stat_statements`

### Rischio 3: Downtime Durante Deploy
**Mitigazione**:
- ✅ Deploy in orario non lavorativo
- ✅ Preparare tutto in anticipo
- ✅ Script automatico di rollback
- ✅ Tempo stimato: 30 minuti downtime

### Rischio 4: Accesso Concorrente
**Mitigazione**:
- ✅ PostgreSQL gestisce connessioni multiple nativamente
- ✅ Connection pooling con Prisma
- ✅ Transazioni ACID garantite

---

## 📊 Vantaggi Attesi

### Prestazioni
- ✅ **Concorrenza**: Multiple app possono accedere simultaneamente
- ✅ **Query complesse**: JOIN e aggregazioni più veloci
- ✅ **Full-text search**: Ricerca inventario più efficiente

### Affidabilità
- ✅ **Backup robusti**: `pg_dump` testato e affidabile
- ✅ **ACID compliance**: Transazioni garantite
- ✅ **No corruzione**: PostgreSQL molto più robusto di SQLite

### Scalabilità
- ✅ **API condivise**: Altre app possono accedere ai dati
- ✅ **Inventario centralizzato**: Accessibile da mobile/web
- ✅ **Future integrazioni**: Facile aggiungere nuove app

### Manutenzione
- ✅ **Backup centralizzato**: Un solo sistema di backup
- ✅ **Monitoring**: Tool enterprise per PostgreSQL
- ✅ **Auto-restart**: Container con health check

---

## 🎯 Timeline Proposta

| Fase | Durata | Quando |
|------|--------|--------|
| 1. Setup PostgreSQL | 1-2 ore | Subito |
| 2. Aggiorna Schema | 30 min | Subito |
| 3. Test Locale | 1 ora | Oggi |
| 4. Migrazione Dati | 1 ora | Domani mattina |
| 5. Deploy Produzione | 30 min | Domani pomeriggio |
| 6. Verifica e Monitoring | 1 settimana | Ongoing |

**Totale tempo implementazione**: ~5-6 ore  
**Downtime previsto**: 30 minuti

---

## ✅ Checklist Pre-Deploy

- [ ] Backup completo SQLite attuale
- [ ] Test connessione PostgreSQL da locale
- [ ] Schema Prisma aggiornato e testato
- [ ] Migration script testato su dati sample
- [ ] Docker compose configurato
- [ ] Environment variables aggiornate
- [ ] Script rollback preparato
- [ ] Documentazione aggiornata

---

## 🚀 Pronto per Iniziare?

**Prossimo Step**: 
```bash
# Fase 1 - Setup PostgreSQL su NAS
ssh admin@192.168.1.248 "mkdir -p /share/Container/postgres-data"
```

Vuoi procedere con la **Fase 1** (Setup PostgreSQL)?
