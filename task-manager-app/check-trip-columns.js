const Database = require('better-sqlite3');
const db = new Database('/app/server/prisma/data/tasks.db');

const info = db.prepare('PRAGMA table_info(Trip)').all();
console.log('\n📋 Trip Table Columns:');
info.forEach(col => {
  console.log(`  - ${col.name} (${col.type})`);
});

db.close();
