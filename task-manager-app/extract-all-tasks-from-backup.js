const Database = require('better-sqlite3');
const fs = require('fs');

// Apri il database SQLite dal backup
const db = new Database('./backup_to_check.sql', { readonly: true, fileMustExist: true });

try {
  // Estrai tutti i task
  const tasks = db.prepare('SELECT * FROM Task ORDER BY id').all();
  
  console.log(`📊 Found ${tasks.length} tasks in backup`);
  
  // Salva in JSON
  fs.writeFileSync('./all_tasks_from_backup.json', JSON.stringify(tasks, null, 2));
  
  console.log('✅ Tasks exported to all_tasks_from_backup.json');
  
  // Mostra un'anteprima
  console.log('\n📋 Sample tasks:');
  tasks.slice(0, 5).forEach(task => {
    console.log(`  - ID ${task.id}: ${task.title} (${task.priority})`);
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  db.close();
}
