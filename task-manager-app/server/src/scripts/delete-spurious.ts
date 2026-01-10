import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteSpuriousArticle() {
  try {
    console.log('🗑️  Eliminazione articolo spurio ID 30...');
    
    // Delete from Inventory first (foreign key constraint)
    const invDeleted = await prisma.inventory.deleteMany({
      where: { articleId: 30 }
    });
    console.log(`✅ Righe eliminate da Inventory: ${invDeleted.count}`);

    // Delete from Article
    try {
      const artDeleted = await prisma.article.delete({
        where: { id: 30 }
      });
      console.log(`✅ Articolo eliminato: ID ${artDeleted.id} - Code: ${artDeleted.code}`);
    } catch (e: any) {
      if (e.code === 'P2025') {
        console.log('ℹ️  Articolo ID 30 non trovato (potrebbe essere già stato eliminato)');
      } else {
        throw e;
      }
    }

    // Verifica che sia stato eliminato
    const check = await prisma.article.findUnique({
      where: { id: 30 }
    });
    
    if (check) {
      console.log('❌ ERRORE: Articolo ID 30 è ancora presente!');
    } else {
      console.log('✅ CONFERMATO: Articolo spurio completamente rimosso dal database');
    }

  } catch (error: any) {
    console.error('❌ Errore critico:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteSpuriousArticle();
