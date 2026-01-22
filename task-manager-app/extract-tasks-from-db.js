const Database = require('better-sqlite3');
const fs = require('fs');

const dbFile = process.argv[2] || '../OLD_TASKS_WITH_20_ITEMS.db';

try {
  const db = new Database(dbFile, { readonly: true, fileMustExist: true });
  
  // Estrai tutti i task
  const tasks = db.prepare('SELECT * FROM Task ORDER BY id').all();
  
  console.log(`📊 Found ${tasks.length} tasks in ${dbFile}`);
  
  // Salva in JSON
  const outputFile = dbFile.replace('.db', '_tasks.json');
  fs.writeFileSync(outputFile, JSON.stringify(tasks, null, 2));
  
  console.log(`✅ Tasks exported to ${outputFile}`);
  
  // Mostra tutti i task
  console.log('\n📋 All tasks:');
  tasks.forEach(task => {
    const status = task.completed ? '✅' : task.paused ? '⏸️' : '🔄';
    console.log(`  ${status} ID ${task.id}: ${task.title} (${task.priority || 'MEDIUM'})`);
  });
  
  db.close();
} catch (error) {
  console.error('❌ Error:', error.message);
}
