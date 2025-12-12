const Database = require('better-sqlite3');
const db = new Database('/app/server/prisma/data/tasks.db');
try {
  db.exec('ALTER TABLE "Trip" ADD COLUMN "sequence" TEXT DEFAULT NULL;');
  console.log('✅ sequence column added to Trip table');
} catch (err) {
  if (!err.message.includes('duplicate column')) {
    console.error('❌ Error:', err.message);
  } else {
    console.log('✅ sequence column already exists');
  }
}
db.close();
