const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    const trips = await prisma.trip.findMany();
    console.log('✅ Viaggi nel DB:', trips.length);
    trips.forEach(t => {
      console.log(`  - ID: ${t.id}, Nome: ${t.name}, Data: ${t.date}, Sequenza: ${JSON.stringify(t.sequence)}`);
    });
    
    const orders = await prisma.order.findMany();
    console.log('✅ Ordini nel DB:', orders.length);
    orders.forEach(o => {
      console.log(`  - ID: ${o.id}, Cliente: ${o.client}, Trip: ${o.tripId}`);
    });
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
