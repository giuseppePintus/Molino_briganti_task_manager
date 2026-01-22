# MariaDB 10.5.8 Setup - Comandi Rapidi

**Data**: 20 Gennaio 2026  
**Database**: MariaDB 10.5.8 (App Center QNAP)

---

## 📝 Credenziali Pianificate

```env
MYSQL_ROOT_PASSWORD=***REDACTED_NAS_PASSWORD***Root
MYSQL_DATABASE=molino_production
MYSQL_USER=molino_user
MYSQL_PASSWORD=***REDACTED_DB_PASSWORD***
MYSQL_HOST=192.168.1.248
MYSQL_PORT=3306
```

---

## 🔧 STEP 1: Verifica Installazione

Dopo che l'installazione è completata via App Center:

```bash
# Verifica che MariaDB sia in esecuzione
echo ***REDACTED_NAS_PASSWORD*** | ssh admin@192.168.1.248 "ps aux | grep mysqld | grep -v grep"

# Verifica porta 3306 in ascolto
echo ***REDACTED_NAS_PASSWORD*** | ssh admin@192.168.1.248 "netstat -tuln | grep 3306"

# Test versione
echo ***REDACTED_NAS_PASSWORD*** | ssh admin@192.168.1.248 "mysql --version"
```

---

## 🔧 STEP 2: Configurazione Database e Utente

### Connessione come root
```bash
# Via SSH
ssh admin@192.168.1.248
mysql -u root -p
# Password: quella impostata durante installazione
```

### Comandi SQL da eseguire
```sql
-- 1. Creare database
CREATE DATABASE IF NOT EXISTS molino_production 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 2. Creare utente applicazione
CREATE USER 'molino_user'@'%' IDENTIFIED BY '***REDACTED_DB_PASSWORD***';

-- 3. Garantire privilegi
GRANT ALL PRIVILEGES ON molino_production.* TO 'molino_user'@'%';

-- 4. Garantire accesso da network (per sviluppo locale)
GRANT ALL PRIVILEGES ON molino_production.* TO 'molino_user'@'192.168.1.%';

-- 5. Flush privileges
FLUSH PRIVILEGES;

-- 6. Verificare utente creato
SELECT user, host FROM mysql.user WHERE user = 'molino_user';

-- 7. Verificare database
SHOW DATABASES;

-- 8. Selezionare database
USE molino_production;

-- 9. Verificare tabelle (dovrebbe essere vuoto)
SHOW TABLES;

-- 10. Esci
EXIT;
```

---

## 🔧 STEP 3: Test Connessione

### Da NAS (interno)
```bash
ssh admin@192.168.1.248
mysql -u molino_user -p molino_production
# Password: ***REDACTED_DB_PASSWORD***

# Se connessione OK, vedrai:
# MariaDB [molino_production]>
```

### Da Windows (remoto)
```bash
# Installare MySQL client su Windows (se non presente)
# Oppure testare via app Node.js

node -e "
const mysql = require('mysql2');
const conn = mysql.createConnection({
  host: '192.168.1.248',
  port: 3306,
  user: 'molino_user',
  password: '***REDACTED_DB_PASSWORD***',
  database: 'molino_production'
});
conn.connect((err) => {
  if (err) {
    console.error('❌ Connection failed:', err);
  } else {
    console.log('✅ Connected to MariaDB!');
    conn.end();
  }
});
"
```

---

## 🔧 STEP 4: Configurare Accesso Remoto

Se MariaDB non accetta connessioni remote, modificare configurazione:

```bash
ssh admin@192.168.1.248

# Trovare file configurazione
find /mnt/ext/opt -name "my.cnf" 2>/dev/null

# Editare my.cnf (solitamente in /mnt/ext/opt/mariadb/my.cnf)
# Cercare e modificare:
# bind-address = 127.0.0.1  →  bind-address = 0.0.0.0

# Riavviare MariaDB (via App Center o comando)
# Se via comando:
/etc/init.d/mariadb10.sh restart
```

---

## 🔧 STEP 5: Aggiornare Prisma Schema

### File: `server/prisma/schema.prisma`

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "mysql"  // ← Cambiato da "sqlite"
  url      = env("DATABASE_URL")
}

// ... resto dei model (User, Task, Order, etc.)

// NUOVO: Tabella inventario PDF
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
  metadata    Json?    // MariaDB 10.5+ supporta JSON
  tags        Json?    // Array di tags come JSON
  
  @@index([category])
  @@index([uploadedAt])
  @@fulltext([title, description])
  @@map("pdf_inventory")
}
```

### File: `.env`

```env
# MariaDB Connection
DATABASE_URL="mysql://molino_user:***REDACTED_DB_PASSWORD***@192.168.1.248:3306/molino_production"

# Altre variabili...
NODE_ENV=production
PORT=5000
JWT_SECRET=your-secret-key-change-this
```

---

## 🔧 STEP 6: Prisma Migrate

```bash
# 1. Installare dipendenze (se necessario)
cd task-manager-app
npm install @prisma/client mysql2

# 2. Generare Prisma Client
npx prisma generate

# 3. Creare migrazione iniziale
npx prisma migrate dev --name init_mysql

# Oppure push diretto (senza migration file)
npx prisma db push

# 4. Verificare connessione
npx prisma db pull
```

---

## 🔧 STEP 7: Export/Import Dati da SQLite

### Script Export da SQLite

```javascript
// export-sqlite-data.js
const { PrismaClient: SQLitePrisma } = require('@prisma/client');
const fs = require('fs');

const sqlite = new SQLitePrisma({
  datasources: { db: { url: 'file:./server/prisma/data/tasks.db' } }
});

async function exportData() {
  console.log('📤 Exporting data from SQLite...');
  
  const users = await sqlite.user.findMany();
  const tasks = await sqlite.task.findMany();
  const orders = await sqlite.order.findMany();
  const trips = await sqlite.trip.findMany();
  const customers = await sqlite.customer.findMany();
  const articles = await sqlite.article.findMany();
  const company = await sqlite.company.findMany();
  const taskNotes = await sqlite.taskNote.findMany();
  
  const data = {
    users,
    tasks,
    orders,
    trips,
    customers,
    articles,
    company,
    taskNotes,
    exportDate: new Date().toISOString()
  };
  
  fs.writeFileSync('sqlite-export.json', JSON.stringify(data, null, 2));
  console.log('✅ Export completed: sqlite-export.json');
  console.log(`   Users: ${users.length}`);
  console.log(`   Tasks: ${tasks.length}`);
  console.log(`   Orders: ${orders.length}`);
  console.log(`   Trips: ${trips.length}`);
  console.log(`   Customers: ${customers.length}`);
  
  await sqlite.$disconnect();
}

exportData().catch(console.error);
```

### Script Import in MariaDB

```javascript
// import-to-mariadb.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function importData() {
  console.log('📥 Importing data to MariaDB...');
  
  const data = JSON.parse(fs.readFileSync('sqlite-export.json', 'utf8'));
  
  // Import in ordine (rispettando foreign keys)
  console.log('Importing users...');
  for (const user of data.users) {
    await prisma.user.create({ data: user });
  }
  
  console.log('Importing customers...');
  for (const customer of data.customers) {
    await prisma.customer.create({ data: customer });
  }
  
  console.log('Importing articles...');
  for (const article of data.articles) {
    await prisma.article.create({ data: article });
  }
  
  console.log('Importing company...');
  for (const comp of data.company) {
    await prisma.company.create({ data: comp });
  }
  
  console.log('Importing tasks...');
  for (const task of data.tasks) {
    await prisma.task.create({ data: task });
  }
  
  console.log('Importing orders...');
  for (const order of data.orders) {
    await prisma.order.create({ data: order });
  }
  
  console.log('Importing trips...');
  for (const trip of data.trips) {
    await prisma.trip.create({ data: trip });
  }
  
  console.log('Importing task notes...');
  for (const note of data.taskNotes) {
    await prisma.taskNote.create({ data: note });
  }
  
  console.log('✅ Import completed!');
  await prisma.$disconnect();
}

importData().catch(console.error);
```

---

## 🔧 STEP 8: Configurare Backup Automatico

### Script Backup (cron job sul NAS)

```bash
#!/bin/bash
# /share/Container/scripts/mariadb-backup.sh

BACKUP_DIR="/share/Container/backups/mariadb"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$DATE.sql"
RETENTION_DAYS=30

# Creare directory se non esiste
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u root -p***REDACTED_NAS_PASSWORD***Root \
  --single-transaction \
  --routines \
  --triggers \
  molino_production > $BACKUP_FILE

# Comprimere
gzip $BACKUP_FILE

# Log
echo "$(date): Backup created: $BACKUP_FILE.gz" >> $BACKUP_DIR/backup.log

# Pulire backup vecchi (> 30 giorni)
find $BACKUP_DIR -name "backup-*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### Rendere eseguibile e testare
```bash
ssh admin@192.168.1.248
chmod +x /share/Container/scripts/mariadb-backup.sh
/share/Container/scripts/mariadb-backup.sh
```

### Aggiungere a cron (ogni ora)
```bash
# Editare crontab
crontab -e

# Aggiungere linea:
0 * * * * /share/Container/scripts/mariadb-backup.sh >> /share/Container/backups/mariadb/cron.log 2>&1
```

---

## 🔧 STEP 9: Aggiornare Docker Compose (Opzionale)

Se vuoi gestire tutto con Docker Compose:

```yaml
version: '3.8'

services:
  molino-app:
    build: .
    container_name: molino-app
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://molino_user:***REDACTED_DB_PASSWORD***@192.168.1.248:3306/molino_production
      - PORT=5000
    ports:
      - "5000:5000"
    volumes:
      - /share/Container/data/molino/uploads:/app/uploads
    networks:
      - molino-network

networks:
  molino-network:
    driver: bridge
```

---

## ✅ Checklist Configurazione

- [ ] MariaDB 10.5.8 installato via App Center
- [ ] Password root impostata
- [ ] Database `molino_production` creato
- [ ] Utente `molino_user` creato con privilegi
- [ ] Connessione remota abilitata (bind-address = 0.0.0.0)
- [ ] Test connessione da Windows OK
- [ ] Prisma schema aggiornato a MySQL
- [ ] Prisma migrate eseguito
- [ ] Dati migrati da SQLite
- [ ] Backup automatico configurato
- [ ] Container app aggiornato con nuova DATABASE_URL

---

## 🐛 Troubleshooting

### Problema: Connessione rifiutata da remoto
```bash
# 1. Verificare bind-address
ssh admin@192.168.1.248
grep bind-address /mnt/ext/opt/mariadb/my.cnf

# 2. Deve essere: bind-address = 0.0.0.0 (non 127.0.0.1)

# 3. Verificare firewall
iptables -L -n | grep 3306
```

### Problema: Access denied for user
```sql
-- Verificare privilegi
SELECT user, host FROM mysql.user WHERE user = 'molino_user';

-- Re-garantire privilegi
GRANT ALL PRIVILEGES ON molino_production.* TO 'molino_user'@'%';
FLUSH PRIVILEGES;
```

### Problema: Too many connections
```sql
-- Aumentare max_connections
SET GLOBAL max_connections = 200;
```

---

## 🎯 Prossimi Step

Dopo configurazione completata:
1. ✅ Testare app localmente con MariaDB
2. ✅ Verificare tutte le API funzionano
3. ✅ Deploy su NAS con nuova configurazione
4. ✅ Monitorare performance per 1 settimana
5. ✅ Implementare API inventario PDF
