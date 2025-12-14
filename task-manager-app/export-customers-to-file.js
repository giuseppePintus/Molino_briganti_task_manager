/**
 * Esporta clienti dal database e salva nel file JSON
 * Esegui: cd /app && node export-customers-to-file.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = '/app/server/prisma/data/tasks.db';
const outputPath = '/app/data/customers.json';

try {
  // Apri database
  const db = new Database(dbPath);
  
  // Leggi tutti i clienti
  const stmt = db.prepare(`SELECT * FROM "Customer" ORDER BY "name" ASC`);
  const customers = stmt.all();
  
  console.log(`✅ Found ${customers.length} customers in database`);
  
  // Assicura directory
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Salva nel file JSON
  fs.writeFileSync(outputPath, JSON.stringify(customers, null, 2), 'utf-8');
  
  console.log(`✅ Exported ${customers.length} customers to ${outputPath}`);
  console.log(`Sample:`, customers.slice(0, 2));
  
  db.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Error exporting customers:', error.message);
  process.exit(1);
}
