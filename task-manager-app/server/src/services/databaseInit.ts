import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

/**
 * Crea le tabelle del database se non esistono
 */
export async function createTablesIfNotExist(prisma: PrismaClient) {
  try {
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
        "code" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "category" TEXT,
        "unit" TEXT NOT NULL DEFAULT 'kg',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Inventory" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "articleId" INTEGER NOT NULL UNIQUE,
        "currentStock" INTEGER NOT NULL DEFAULT 0,
        "minimumStock" INTEGER NOT NULL DEFAULT 0,
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

    console.log('✅ Database tables created successfully');
  } catch (error: any) {
    // Ignora errori se le tabelle esistono già
    if (!error.message.includes('already exists')) {
      console.error('⚠️  Error creating tables:', error.message);
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

    return {
      admins: [admin1, admin2],
      operators: [operator1, operator2],
    };
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}
