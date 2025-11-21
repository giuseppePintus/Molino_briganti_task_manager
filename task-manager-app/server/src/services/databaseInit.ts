import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

/**
 * Inizializza il database con utenti di default se non esiste nessun utente
 */
export async function initializeDatabaseIfEmpty(prisma: PrismaClient) {
  try {
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
