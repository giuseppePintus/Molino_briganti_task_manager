const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteAllData() {
  try {
    console.log('🗑️ Eliminazione dati in corso...');
    
    const orders = await prisma.order.deleteMany({});
    console.log(`✅ Ordini eliminati: ${orders.count}`);
    
    const trips = await prisma.trip.deleteMany({});
    console.log(`✅ Viaggi eliminati: ${trips.count}`);
    
    console.log('✅ Pulizia completata!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

deleteAllData();
