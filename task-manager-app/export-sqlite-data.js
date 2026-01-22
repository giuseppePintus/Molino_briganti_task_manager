// export-sqlite-data.js
// Script per esportare tutti i dati da SQLite prima della migrazione a MariaDB
// Usa better-sqlite3 direttamente per bypassare Prisma che è configurato per MySQL

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Connessione diretta a SQLite
const dbPath = path.join(__dirname, 'server/prisma/data/tasks.db');
console.log(`📂 Database path: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error('❌ SQLite database not found at:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// Funzione helper per controllare se una tabella esiste
function tableExists(tableName) {
  const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
  return !!result;
}

// Funzione helper per export sicuro
function safeExport(tableName, displayName) {
  if (tableExists(tableName)) {
    console.log(`📊 Exporting ${displayName}...`);
    const data = db.prepare(`SELECT * FROM ${tableName}`).all();
    console.log(`   ✅ ${data.length} records exported`);
    return data;
  } else {
    console.log(`⚠️  ${displayName} table not found in SQLite (will be empty in MariaDB)`);
    return [];
  }
}

async function exportAllData() {
  console.log('📤 Starting SQLite data export...\n');
  
  try {
    // Export all tables
    const users = safeExport('User', 'Users');
    const tasks = safeExport('Task', 'Tasks');
    const orders = safeExport('"Order"', 'Orders');
    const orderItems = safeExport('OrderItem', 'Order Items');
    const trips = safeExport('Trip', 'Trips');
    const customers = safeExport('Customer', 'Customers');
    const articles = safeExport('Article', 'Articles');
    const companySettings = safeExport('CompanySettings', 'Company Settings');
    const taskNotes = safeExport('TaskNote', 'Task Notes');
    const inventory = safeExport('Inventory', 'Inventory');
    const vehicles = safeExport('Vehicle', 'Vehicles');
    const warehouses = safeExport('Warehouse', 'Warehouses');
    const holidays = safeExport('Holiday', 'Holidays');
    const stockAlerts = safeExport('StockAlert', 'Stock Alerts');
    const stockMovements = safeExport('StockMovement', 'Stock Movements');

    const totalRecords = users.length + tasks.length + orders.length + orderItems.length + 
                         trips.length + customers.length + articles.length + companySettings.length +
                         taskNotes.length + inventory.length + vehicles.length + 
                         warehouses.length + holidays.length + stockAlerts.length + stockMovements.length;

    // Prepare export data structure
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        databaseType: 'SQLite',
        totalRecords: totalRecords
      },
      users,
      tasks,
      orders,
      orderItems,
      trips,
      customers,
      articles,
      companySettings,
      taskNotes,
      inventory,
      vehicles,
      warehouses,
      holidays,
      stockAlerts,
      stockMovements
    };

    // Save to JSON file
    const exportPath = path.join(__dirname, 'sqlite-migration-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

    console.log('\n✅ Export completed successfully!');
    console.log(`📁 File saved to: ${exportPath}`);
    console.log(`📊 Total records exported: ${exportData.metadata.totalRecords}`);
    console.log('\n📋 Summary:');
    console.log(`   Users: ${exportData.users.length}`);
    console.log(`   Tasks: ${exportData.tasks.length}`);
    console.log(`   Orders: ${exportData.orders.length}`);
    console.log(`   Order Items: ${exportData.orderItems.length}`);
    console.log(`   Trips: ${exportData.trips.length}`);
    console.log(`   Customers: ${exportData.customers.length}`);
    console.log(`   Articles: ${exportData.articles.length}`);
    console.log(`   Company Settings: ${exportData.companySettings.length}`);
    console.log(`   Task Notes: ${exportData.taskNotes.length}`);
    console.log(`   Inventory: ${exportData.inventory.length}`);
    console.log(`   Vehicles: ${exportData.vehicles.length}`);
    console.log(`   Warehouses: ${exportData.warehouses.length}`);
    console.log(`   Holidays: ${exportData.holidays.length}`);
    console.log(`   Stock Alerts: ${exportData.stockAlerts.length}`);
    console.log(`   Stock Movements: ${exportData.stockMovements.length}`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run export
exportAllData()
  .then(() => {
    console.log('\n🎉 Migration export ready!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
