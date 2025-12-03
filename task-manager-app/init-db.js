const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Initializing database with default users...');

    // Clear existing users
    await prisma.user.deleteMany({});
    console.log('🗑️ Cleared existing users');

    // Create default users
    const users = [
      {
        username: 'Manuel',
        name: 'Manuel',
        email: 'manuel@molino.it',
        password: '123',
        role: 'master'
      },
      {
        username: 'Lucia',
        name: 'Admin Lucia',
        email: 'lucia@molino.it',
        password: '123',
        role: 'master'
      },
      {
        username: 'Paolo',
        name: 'Operatore Paolo',
        email: 'paolo@molino.it',
        password: 'operator123',
        role: 'slave'
      },
      {
        username: 'Sara',
        name: 'Operatore Sara',
        email: 'sara@molino.it',
        password: 'operator123',
        role: 'slave'
      }
    ];

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const created = await prisma.user.create({
        data: {
          username: user.username,
          passwordHash: hashedPassword,
          role: user.role
        }
      });
      console.log(`✅ Created user: ${user.name} (${user.role})`);
    }

    console.log('\n✅ Database initialized successfully!');
    console.log('📌 Login with:');
    console.log('   User: Manuel');
    console.log('   Password: 123');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
