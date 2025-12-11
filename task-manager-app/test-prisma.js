const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPrismaTrip() {
  try {
    console.log('\n🧪 Test Prisma Trip Creation\n');
    
    // Get user first
    const user = await prisma.user.findUnique({
      where: { id: 6 }
    });
    
    console.log(`Found user: ${user.username} (ID: ${user.id})`);
    
    // Try to create trip
    console.log('\n📝 Attempting to create trip with Prisma...\n');
    
    const trip = await prisma.trip.create({
      data: {
        name: 'Prisma Test Trip',
        date: new Date('2025-12-15T10:00:00Z'),
        assignedOperatorId: 6,
        vehicleName: 'Furgone',
        status: 'planned'
      },
      include: {
        assignedOperator: {
          select: { id: true, username: true }
        }
      }
    });
    
    console.log('✅ SUCCESS! Trip created:');
    console.log(`  ID: ${trip.id}`);
    console.log(`  Name: ${trip.name}`);
    console.log(`  Status: ${trip.status}`);
    console.log(`  Operator: ${trip.assignedOperator?.username || 'None'}`);
    
  } catch (err) {
    console.log('❌ ERROR:', err.message);
    if (err.code) console.log('Code:', err.code);
    if (err.meta) console.log('Meta:', err.meta);
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaTrip();
