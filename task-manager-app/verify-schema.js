const Database = require('better-sqlite3');
const path = require('path');

const dbPath = '/app/server/prisma/data/tasks.db';
const db = new Database(dbPath);

// Get Trip table schema
const tripInfo = db.prepare("PRAGMA table_info(Trip)").all();
console.log('\n📋 Trip Table Schema:');
console.log('═'.repeat(60));
tripInfo.forEach((col, idx) => {
  console.log(`${idx + 1}. ${col.name}`);
  console.log(`   Type: ${col.type} ${col.notnull ? '(NOT NULL)' : '(nullable)'}`);
  if (col.pk) console.log(`   PRIMARY KEY`);
  if (col.dflt_value) console.log(`   DEFAULT: ${col.dflt_value}`);
});

// Check if assignedOperatorId exists
const hasField = tripInfo.some(col => col.name === 'assignedOperatorId');
console.log('\n✓ Has assignedOperatorId field:', hasField ? '✅ YES' : '❌ NO');

// Get foreign keys
console.log('\n📌 Foreign Keys:');
const fkInfo = db.prepare("PRAGMA foreign_key_list(Trip)").all();
if (fkInfo.length === 0) {
  console.log('❌ No foreign keys defined');
} else {
  fkInfo.forEach(fk => {
    console.log(`${fk.from} -> ${fk.table}.${fk.to}`);
  });
}

// Check User table
console.log('\n👤 Checking User table:');
const users = db.prepare("SELECT id, username FROM User").all();
console.log(`Found ${users.length} users:`);
users.forEach(u => {
  console.log(`  - ID: ${u.id}, Username: ${u.username}`);
});

db.close();
