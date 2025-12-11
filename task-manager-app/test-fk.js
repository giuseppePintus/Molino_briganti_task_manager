const Database = require('better-sqlite3');

const dbPath = '/app/server/prisma/data/tasks.db';
const db = new Database(dbPath);

console.log('\n🔍 Diagnostica FK Constraint:\n');

// Check if foreign keys are enabled
const fkStatus = db.pragma('foreign_keys');
console.log(`Foreign Keys Enabled: ${fkStatus ? '✅ YES' : '❌ NO'}`);

// Try to enable them explicitly
db.pragma('foreign_keys = ON');
console.log('Foreign Keys Toggled to ON\n');

// Get all foreign keys on Trip
const fkList = db.prepare("PRAGMA foreign_key_list(Trip)").all();
console.log('Foreign Keys on Trip table:');
if (fkList.length === 0) {
  console.log('❌ NO FOREIGN KEYS DEFINED');
} else {
  fkList.forEach(fk => {
    console.log(`  Column: ${fk.from}`);
    console.log(`  References: ${fk.table}.${fk.to}`);
    console.log(`  On Delete: ${fk.on_delete || 'RESTRICT'}`);
    console.log(`  On Update: ${fk.on_update || 'RESTRICT'}`);
  });
}

// Try to insert a test trip with assignedOperatorId=6
console.log('\n🧪 Test: Inserting trip with assignedOperatorId=6...\n');

try {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO Trip (name, date, assignedOperatorId, vehicleName, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('Test Trip Direct Insert', '2025-12-15T10:00:00Z', 6, 'Furgone', 'planned', now, now);
  
  console.log('✅ SUCCESS! Trip created with ID:', result.lastInsertRowid);
  
  // Verify it was inserted
  const trip = db.prepare('SELECT * FROM Trip WHERE id = ?').get(result.lastInsertRowid);
  console.log('\n📋 Inserted Trip:');
  Object.entries(trip).forEach(([key, val]) => {
    console.log(`  ${key}: ${val}`);
  });
  
} catch (err) {
  console.log('❌ ERROR:', err.message);
  console.log('Code:', err.code);
}

db.close();
