import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import { execSync } from 'child_process';

/**
 * Crea le tabelle del database se non esistono
 */
export async function createTablesIfNotExist(prisma: PrismaClient) {
  try {
    // Assicura che il Prisma client sia rigenerato per l'attuale schema
    console.log('🔄 Ensuring Prisma Client is up-to-date...');
    try {
      execSync('npm run prisma:generate', { stdio: 'inherit', cwd: '/app' });
    } catch (e) {
      // Ignora errori - il Prisma client potrebbe essere già aggiornato
      console.log('⚠️  Prisma generation skipped or failed (may already be current)');
    }
    
    // Disabilita i foreign key constraints per permettere la ricreazione
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);

    
    // Esegui il SQL per creare le tabelle direttamente secondo lo schema Prisma
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "username" TEXT NOT NULL UNIQUE,
        "passwordHash" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "image" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Task" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "scheduledAt" DATETIME,
        "originalScheduledAt" DATETIME,
        "assignedOperatorId" INTEGER,
        "estimatedMinutes" INTEGER,
        "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
        "color" TEXT NOT NULL DEFAULT '#FCD34D',
        "recurring" BOOLEAN NOT NULL DEFAULT 0,
        "recurrenceType" TEXT,
        "recurrenceEnd" DATETIME,
        "parentTaskId" INTEGER,
        "createdById" INTEGER NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "acceptedAt" DATETIME,
        "acceptedById" INTEGER,
        "paused" BOOLEAN NOT NULL DEFAULT 0,
        "pausedAt" DATETIME,
        "completed" BOOLEAN NOT NULL DEFAULT 0,
        "completedById" INTEGER,
        "completedAt" DATETIME,
        "actualMinutes" INTEGER,
        CONSTRAINT "Task_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Task_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TaskNote" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "task" INTEGER NOT NULL,
        "taskId" INTEGER NOT NULL,
        "user" INTEGER NOT NULL,
        "userId" INTEGER NOT NULL,
        "note" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "TaskNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    // Tabelle inventory
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Article" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "category" TEXT,
        "unit" TEXT NOT NULL DEFAULT 'kg',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Rimuovi eventuale indice univoco su Article.code che impedisce duplicati in posizioni diverse
    try {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Article_code_key"`);
    } catch (e) {
      // Ignora se non esiste
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Inventory" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "articleId" INTEGER NOT NULL UNIQUE,
        "currentStock" INTEGER NOT NULL DEFAULT 0,
        "minimumStock" INTEGER NOT NULL DEFAULT 0,
        "position" TEXT,
        "shelfPosition" TEXT,
        "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "notes" TEXT,
        CONSTRAINT "Inventory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StockMovement" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "inventoryId" INTEGER NOT NULL,
        "type" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL,
        "reason" TEXT,
        "orderId" INTEGER,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdBy" INTEGER NOT NULL,
        CONSTRAINT "StockMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StockAlert" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "articleId" INTEGER NOT NULL,
        "inventoryId" INTEGER NOT NULL,
        "alertType" TEXT NOT NULL,
        "currentStock" INTEGER NOT NULL,
        "minimumStock" INTEGER NOT NULL,
        "isResolved" BOOLEAN NOT NULL DEFAULT 0,
        "resolvedAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StockAlert_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "StockAlert_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OrderItem" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "orderId" INTEGER NOT NULL,
        "articleId" INTEGER NOT NULL,
        "quantityOrdered" INTEGER NOT NULL,
        "quantityDelivered" INTEGER NOT NULL DEFAULT 0,
        "unitPrice" REAL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OrderItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);

    // Crea indici per performance
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockAlert_isResolved_idx" ON "StockAlert"("isResolved")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockAlert_createdAt_idx" ON "StockAlert"("createdAt")`);

    // Tabelle per ordini e clienti
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Customer" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "code" TEXT UNIQUE,
        "name" TEXT NOT NULL,
        "address" TEXT,
        "city" TEXT,
        "province" TEXT,
        "cap" TEXT,
        "phone" TEXT,
        "email" TEXT,
        "piva" TEXT,
        "cf" TEXT,
        "notes" TEXT,
        "openingTime" TEXT,
        "closingTime" TEXT,
        "deliveryStartTime" TEXT,
        "deliveryEndTime" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Order" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "type" TEXT NOT NULL,
        "customerId" INTEGER,
        "clientName" TEXT,
        "products" TEXT,
        "tripId" INTEGER,
        "assignedOperatorId" INTEGER,
        "dateTime" DATETIME,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "assignedAt" DATETIME,
        "acceptedAt" DATETIME,
        "completedAt" DATETIME,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Order_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Trip" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "date" DATETIME NOT NULL,
        "assignedOperatorId" INTEGER,
        "vehicleId" INTEGER,
        "vehicleName" TEXT,
        "sequence" TEXT,
        "status" TEXT NOT NULL DEFAULT 'planned',
        "startedAt" DATETIME,
        "completedAt" DATETIME,
        "notes" TEXT,
        "accepted" BOOLEAN NOT NULL DEFAULT 0,
        "acceptedAt" DATETIME,
        "printed" BOOLEAN NOT NULL DEFAULT 0,
        "printedAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Trip_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    // Aggiungi colonne mancanti ai Trip se non esistono (migration per DB vecchi)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Trip" ADD COLUMN "accepted" BOOLEAN NOT NULL DEFAULT 0
      `);
    } catch (e) {
      // La colonna potrebbe già esistere, ignora l'errore
    }
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Trip" ADD COLUMN "acceptedAt" DATETIME
      `);
    } catch (e) {
      // La colonna potrebbe già esistere, ignora l'errore
    }
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Trip" ADD COLUMN "printed" BOOLEAN NOT NULL DEFAULT 0
      `);
    } catch (e) {
      // La colonna potrebbe già esistere, ignora l'errore
    }
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Trip" ADD COLUMN "printedAt" DATETIME
      `);
    } catch (e) {
      // La colonna potrebbe già esistere, ignora l'errore
    }

    // Aggiungi colonna assignedOperatorId se non esiste (migration per DB vecchi)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Trip" ADD COLUMN "assignedOperatorId" INTEGER DEFAULT NULL
      `);
    } catch (e) {
      // La colonna potrebbe già esistere, ignora l'errore
    }

    // Aggiungi il foreign key se non esiste (sqlite non supporta ALTER TABLE ADD CONSTRAINT, 
    // ma Prisma almeno creerà il record, sarà validato a livello app)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Vehicle" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "plate" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Holiday" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "date" DATETIME NOT NULL UNIQUE,
        "description" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CompanySettings" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "key" TEXT NOT NULL UNIQUE,
        "value" TEXT NOT NULL,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Aggiungi colonna assignedAt se manca in Task
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Task" ADD COLUMN "assignedAt" DATETIME
      `);
    } catch (error: any) {
      // Colonna potrebbe già esistere
      if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
        console.log('Note:', error.message);
      }
    }

    // Aggiungi colonna "reserved" se manca in Inventory
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Inventory" ADD COLUMN "reserved" INTEGER NOT NULL DEFAULT 0
      `);
    } catch (error: any) {
      if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
        console.log('Note:', error.message);
      }
    }

    // Aggiungi colonna "batch" e "expiry" se mancano in Inventory
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Inventory" ADD COLUMN "batch" TEXT
      `);
    } catch (error: any) {
      if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
        console.log('Note:', error.message);
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Inventory" ADD COLUMN "expiry" TEXT
      `);
    } catch (error: any) {
      if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
        console.log('Note:', error.message);
      }
    }

    // Aggiungi colonna "position" se manca in Inventory
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Inventory" ADD COLUMN "position" TEXT
      `);
    } catch (error: any) {
      if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
        console.log('Note:', error.message);
      }
    }

    // Aggiungi colonna "type" se manca in StockMovement
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "StockMovement" ADD COLUMN "type" TEXT
      `);
    } catch (error: any) {
      if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
        console.log('Note:', error.message);
      }
    }

    console.log('✅ Database tables created successfully');
  } catch (error: any) {
    // Ignora errori se le tabelle esistono già
    console.error('⚠️  Error creating tables:', error.message, error.code);
    if (!error.message.includes('already exists')) {
      // Logga sempre, non silenzioso
    }
  }
}

/**
 * Inizializza il database con utenti di default se non esiste nessun utente
 */
export async function initializeDatabaseIfEmpty(prisma: PrismaClient) {
  try {
    // Prima crea le tabelle se non esistono
    await createTablesIfNotExist(prisma);

    // Controlla se ci sono utenti nel database
    const userCount = await prisma.user.count();
    
    if (userCount > 0) {
      console.log(`📊 Database initialized with ${userCount} users`);
      return;
    }

    console.log('🌱 Database empty, initializing with default users...');

    // Hash delle password con bcryptjs
    const adminPasswordHash = await bcryptjs.hash('123', 10);
    const operatorPasswordHash = await bcryptjs.hash('operator123', 10);
    
    // Crea admin di default
    const admin1 = await prisma.user.create({
      data: {
        username: 'Manuel',
        passwordHash: adminPasswordHash,
        role: 'master',
        image: null,
      },
    });

    const admin2 = await prisma.user.create({
      data: {
        username: 'Admin Lucia',
        passwordHash: adminPasswordHash,
        role: 'master',
        image: null,
      },
    });

    // Crea operatori di default
    const operator1 = await prisma.user.create({
      data: {
        username: 'Operatore Paolo',
        passwordHash: operatorPasswordHash,
        role: 'slave',
        image: null,
      },
    });

    const operator2 = await prisma.user.create({
      data: {
        username: 'Operatore Sara',
        passwordHash: operatorPasswordHash,
        role: 'slave',
        image: null,
      },
    });

    console.log('✅ Default users created:');
    console.log(`   📌 ${admin1.username} (Admin) - Password: 123`);
    console.log(`   📌 ${admin2.username} (Admin) - Password: 123`);
    console.log(`   👤 ${operator1.username} (Operator) - Password: operator123`);
    console.log(`   👤 ${operator2.username} (Operator) - Password: operator123`);
    console.log('⚠️  IMPORTANTE: Cambia le password di default in produzione!');

    // Re-abilita i foreign key constraints
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);

    return {
      admins: [admin1, admin2],
      operators: [operator1, operator2],
    };
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}
