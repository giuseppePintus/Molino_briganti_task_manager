#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'task-manager-app/server/prisma/data/tasks.db');

try {
  const db = new Database(dbPath);
  
  // Delete from Inventory first (foreign key)
  const deleteInventory = db.prepare('DELETE FROM Inventory WHERE articleId = 30');
  deleteInventory.run();
  
  // Delete from Article
  const deleteArticle = db.prepare(`DELETE FROM Article WHERE id = 30 AND code = 'Codice'`);
  const result = deleteArticle.run();
  
  console.log('✅ Articolo spurio (ID 30) eliminato');
  console.log(`   Righe eliminate: ${result.changes}`);
  
  db.close();
} catch (error) {
  console.error('❌ Errore:', error.message);
  process.exit(1);
}
