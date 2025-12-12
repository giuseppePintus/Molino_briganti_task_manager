const Database = require('better-sqlite3');
const db = new Database('/app/server/prisma/data/tasks.db');

console.log('=== TRIP TABLE SCHEMA ===');
const tripSchema = db.prepare('PRAGMA table_info(Trip)').all();
tripSchema.forEach(col => console.log(`${col.name}: ${col.type}`));

console.log('\n=== ORDER TABLE SCHEMA ===');
const orderSchema = db.prepare('PRAGMA table_info("Order")').all();
orderSchema.forEach(col => console.log(`${col.name}: ${col.type}`));

console.log('\n=== SAMPLE TRIPS ===');
const trips = db.prepare('SELECT * FROM Trip LIMIT 3').all();
trips.forEach(t => console.log(JSON.stringify(t, null, 2)));

console.log('\n=== TOTAL TRIPS:', db.prepare('SELECT COUNT(*) as count FROM Trip').get().count);
console.log('=== TOTAL ORDERS:', db.prepare('SELECT COUNT(*) as count FROM "Order"').get().count);

db.close();
