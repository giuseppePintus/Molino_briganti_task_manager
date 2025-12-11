const Database = require('better-sqlite3');

const dbPath = '/app/server/prisma/data/tasks.db';
const db = new Database(dbPath);

console.log('\n🔧 Adding missing "sequence" column to Trip table...\n');

try {
  // Add sequence column if it doesn't exist
  db.exec(`
    ALTER TABLE "Trip" ADD COLUMN "sequence" TEXT DEFAULT NULL;
  `);
  
  console.log('✅ "sequence" column added successfully');
  
  // Verify it was added
  const info = db.prepare('PRAGMA table_info(Trip)').all();
  console.log('\n📋 Trip Table Columns (after fix):');
  info.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
} catch (err) {
  if (err.message.includes('duplicate column name')) {
    console.log('✅ "sequence" column already exists');
  } else {
    console.log('❌ ERROR:', err.message);
  }
}

db.close();
