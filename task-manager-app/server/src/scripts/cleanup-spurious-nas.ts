import Database from 'better-sqlite3';

const database = new Database('/share/Container/task-manager-app/server/prisma/data/tasks.db');

async function deleteSpuriousArticle() {
  try {
    const deleted = database.prepare('DELETE FROM Article WHERE code = ?').run('Codice');
    console.log(`✅ Articoli eliminati: ${deleted.changes}`);
  } catch (error: any) {
    console.error('❌ Errore:', error.message);
  } finally {
    database.close();
  }
}

deleteSpuriousArticle();
