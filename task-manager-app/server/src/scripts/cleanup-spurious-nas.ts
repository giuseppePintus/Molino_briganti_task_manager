import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:///share/Container/task-manager-app/server/prisma/data/tasks.db'
    }
  }
});

async function deleteSpuriousArticle() {
  try {
    // Delete spurious article with code 'Codice'
    const deleted = await prisma.article.deleteMany({
      where: { code: 'Codice' }
    });
    
    console.log(`✅ Articoli eliminati: ${deleted.count}`);
  } catch (error: any) {
    console.error('❌ Errore:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteSpuriousArticle();
