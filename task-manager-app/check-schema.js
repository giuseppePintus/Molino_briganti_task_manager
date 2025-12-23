const Database = require('better-sqlite3');
const db = new Database('./server/prisma/data/tasks.db');

try {
  // Controlla gli indici sulla tabella Article
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='Article'").all();
  console.log('\n📊 Indexes on Article table:');
  console.log(JSON.stringify(indexes, null, 2));
  
  // Controlla se esiste Article_code_key (vecchio vincolo unique)
  const hasUniqueCode = indexes.some(i => i.name === 'Article_code_key' || i.name.includes('code'));
  
  if (hasUniqueCode) {
    console.log('\n❌ PROBLEMA: Vincolo UNIQUE su code ancora presente!');
    process.exit(1);
  } else {
    console.log('\n✅ OK: Vincolo UNIQUE su code rimosso correttamente!');
    process.exit(0);
  }
} catch (err) {
  console.error('❌ Errore:', err.message);
  process.exit(1);
} finally {
  db.close();
}
