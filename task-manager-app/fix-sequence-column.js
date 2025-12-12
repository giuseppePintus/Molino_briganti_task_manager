const Database = require('better-sqlite3');
const db = new Database('/app/server/prisma/data/tasks.db');

try {
  db.exec('ALTER TABLE "Trip" ADD COLUMN "sequence" TEXT DEFAULT NULL;');
  console.log('✅ sequence column added to Trip table');
} catch (err) {
  if (err.message.includes('duplicate column')) {
    console.log('✅ sequence column already exists');
  } else {
    console.error('❌ Error:', err.message);
  }
}

// Verify
const schema = db.prepare('PRAGMA table_info(Trip)').all();
const hasSequence = schema.some(col => col.name === 'sequence');
console.log('Sequence column exists:', hasSequence);

db.close();
