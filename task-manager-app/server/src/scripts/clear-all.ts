import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllData() {
  try {
    console.log('🗑️ Eliminazione di tutti i task e ordini...');
    
    // Elimina tutti i task
    const deletedTasks = await prisma.task.deleteMany({});
    console.log(`✅ Task eliminati: ${deletedTasks.count}`);
    
    // Elimina tutti gli ordini
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`✅ Ordini eliminati: ${deletedOrders.count}`);
    
    console.log('✅ Operazione completata!');
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllData();
