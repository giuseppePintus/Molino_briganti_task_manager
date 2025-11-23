import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

/**
 * Crea le tabelle del database se non esistono
 */
export async function createTablesIfNotExist(prisma: PrismaClient) {
  try {
    // Esegui il SQL per creare le tabelle direttamente
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "username" TEXT NOT NULL UNIQUE,
        "passwordHash" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'slave',
        "image" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Task" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
        "scheduledAt" DATETIME,
        "estimatedMinutes" INTEGER,
        "actualMinutes" INTEGER,
        "assignedOperatorId" INTEGER,
        "acceptedAt" DATETIME,
        "completed" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Task_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TaskNote" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "content" TEXT NOT NULL,
        "actualMinutes" INTEGER,
        "taskId" INTEGER NOT NULL,
        "createdBy" INTEGER,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "TaskNote_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

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

    // Hash delle password
    const adminPassword = await bcryptjs.hash('admin123', 10);
    const operatorPassword = await bcryptjs.hash('operator123', 10);

    // Crea admin di default
    const admin1 = await prisma.user.create({
      data: {
        username: 'Admin Mario',
        passwordHash: adminPassword,
        role: 'master',
        image: null,
      },
    });

    const admin2 = await prisma.user.create({
      data: {
        username: 'Admin Lucia',
        passwordHash: adminPassword,
        role: 'master',
        image: null,
      },
    });

    // Crea operatori di default
    const operator1 = await prisma.user.create({
      data: {
        username: 'Operatore Paolo',
        passwordHash: operatorPassword,
        role: 'slave',
        image: null,
      },
    });

    const operator2 = await prisma.user.create({
      data: {
        username: 'Operatore Sara',
        passwordHash: operatorPassword,
        role: 'slave',
        image: null,
      },
    });

    console.log('✅ Default users created:');
    console.log(`   📌 ${admin1.username} (Admin) - Password: admin123`);
    console.log(`   📌 ${admin2.username} (Admin) - Password: admin123`);
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
