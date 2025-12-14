const Database = require('better-sqlite3');
const db = new Database('./server/prisma/data/tasks.db');

try {
  // Verifica schema tabella Trip
  const cols = db.prepare('PRAGMA table_info(Trip)').all();
  console.log('Trip columns:');
  cols.forEach(col => {
    console.log(`  ${col.name} (${col.type})`);
  });
  
  // Verifica se sequence esiste
  const hasSequence = cols.find(c => c.name === 'sequence');
  if (!hasSequence) {
    console.log('\n⚠️ Column "sequence" NOT FOUND');
    console.log('Adding sequence column...');
    db.exec(`ALTER TABLE Trip ADD COLUMN sequence TEXT;`);
    console.log('✅ Column sequence added successfully');
  } else {
    console.log('\n✅ Column "sequence" exists');
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
