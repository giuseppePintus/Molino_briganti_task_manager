const Database = require('better-sqlite3');

const db = new Database('./check_settings.db');

console.log('=== CompanySettings ===');
try {
  const settings = db.prepare('SELECT * FROM CompanySettings').all();
  console.log('Rows:', settings.length);
  settings.forEach(s => {
    console.log(JSON.stringify(s, null, 2));
  });
} catch (e) {
  console.log('Errore:', e.message);
}

db.close();
