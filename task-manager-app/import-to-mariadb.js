// import-to-mariadb.js
// Script per importare i dati esportati da SQLite in MariaDB usando Prisma

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper function per gestire date e valori null
function safeDate(value) {
  if (!value) return new Date();
  const date = new Date(value);
  return isNaN(date.getTime()) ? new Date() : date;
}

function safeDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function safeBoolean(value) {
  return value === 1 || value === true;
}

async function importData() {
  console.log('📥 Starting MariaDB data import...\n');
  
  try {
    // Leggi il file JSON esportato
    const exportPath = path.join(__dirname, 'sqlite-migration-export.json');
    console.log(`📂 Reading from: ${exportPath}`);
    
    if (!fs.existsSync(exportPath)) {
      throw new Error('Export file not found. Run export-sqlite-data.js first!');
    }
    
    const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    console.log(`📊 Total records to import: ${exportData.metadata.totalRecords}\n`);

    // ⚠️ IMPORTANTE: L'ordine di import deve rispettare le foreign key
    // 1. Prima gli utenti (non hanno dipendenze)
    // 2. Poi i dati di base (customers, articles, vehicles, warehouses)
    // 3. Infine i dati relazionali (tasks, orders, trips, inventory, etc.)

    // Import Users
    if (exportData.users && exportData.users.length > 0) {
      console.log('👥 Importing Users...');
      for (const user of exportData.users) {
        await prisma.user.create({
          data: {
            id: user.id,
            username: user.username,
            passwordHash: user.password || user.passwordHash || '',
            role: user.role,
            image: user.image || null,
            createdAt: safeDate(user.createdAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.users.length} users imported`);
    }

    // Import Customers
    if (exportData.customers && exportData.customers.length > 0) {
      console.log('🏢 Importing Customers...');
      for (const customer of exportData.customers) {
        await prisma.customer.create({
          data: {
            id: customer.id,
            name: customer.name,
            address: customer.address || null,
            phone: customer.phone || null,
            email: customer.email || null,
            notes: customer.notes || null,
            createdAt: safeDate(customer.createdAt),
            updatedAt: safeDate(customer.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.customers.length} customers imported`);
    }

    // Import Articles
    if (exportData.articles && exportData.articles.length > 0) {
      console.log('📦 Importing Articles...');
      for (const article of exportData.articles) {
        await prisma.article.create({
          data: {
            id: article.id,
            code: article.code,
            description: article.description,
            unit: article.unit || 'unit',
            category: article.category || null,
            notes: article.notes || null,
            active: safeBoolean(article.active),
            createdAt: safeDate(article.createdAt),
            updatedAt: safeDate(article.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.articles.length} articles imported`);
    }

    // Import Vehicles
    if (exportData.vehicles && exportData.vehicles.length > 0) {
      console.log('🚛 Importing Vehicles...');
      for (const vehicle of exportData.vehicles) {
        await prisma.vehicle.create({
          data: {
            id: vehicle.id,
            name: vehicle.name,
            plate: vehicle.plate || null,
            type: vehicle.type || 'truck',
            capacity: vehicle.capacity || null,
            notes: vehicle.notes || null,
            active: safeBoolean(vehicle.active),
            createdAt: safeDate(vehicle.createdAt),
            updatedAt: safeDate(vehicle.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.vehicles.length} vehicles imported`);
    }

    // Import Warehouses
    if (exportData.warehouses && exportData.warehouses.length > 0) {
      console.log('🏭 Importing Warehouses...');
      for (const warehouse of exportData.warehouses) {
        await prisma.warehouse.create({
          data: {
            id: warehouse.id,
            name: warehouse.name,
            location: warehouse.location || null,
            notes: warehouse.notes || null,
            active: safeBoolean(warehouse.active),
            createdAt: safeDate(warehouse.createdAt),
            updatedAt: safeDate(warehouse.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.warehouses.length} warehouses imported`);
    }

    // Import Tasks
    if (exportData.tasks && exportData.tasks.length > 0) {
      console.log('📋 Importing Tasks...');
      for (const task of exportData.tasks) {
        // Mappa il vecchio schema al nuovo
        await prisma.task.create({
          data: {
            id: task.id,
            title: task.title,
            description: task.description || null,
            scheduledAt: safeDateOrNull(task.dueDate),
            assignedOperatorId: task.assignedTo || null,
            priority: task.priority || 'MEDIUM',
            color: '#FCD34D',
            recurring: false,
            createdById: 1, // Default master user
            createdAt: safeDate(task.createdAt),
            completed: task.status === 'completed',
            completedAt: safeDateOrNull(task.completedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.tasks.length} tasks imported`);
    }

    // Import Orders
    if (exportData.orders && exportData.orders.length > 0) {
      console.log('📝 Importing Orders...');
      for (const order of exportData.orders) {
        await prisma.order.create({
          data: {
            id: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            status: order.status || 'pending',
            notes: order.notes || null,
            orderDate: safeDate(order.orderDate),
            deliveryDate: safeDateOrNull(order.deliveryDate),
            createdAt: safeDate(order.createdAt),
            updatedAt: safeDate(order.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.orders.length} orders imported`);
    }

    // Import OrderItems
    if (exportData.orderItems && exportData.orderItems.length > 0) {
      console.log('📑 Importing Order Items...');
      for (const item of exportData.orderItems) {
        await prisma.orderItem.create({
          data: {
            id: item.id,
            orderId: item.orderId,
            articleId: item.articleId,
            quantity: item.quantity,
            unit: item.unit || 'unit',
            notes: item.notes || null,
            createdAt: safeDate(item.createdAt),
            updatedAt: safeDate(item.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.orderItems.length} order items imported`);
    }

    // Import Trips
    if (exportData.trips && exportData.trips.length > 0) {
      console.log('🚚 Importing Trips...');
      for (const trip of exportData.trips) {
        await prisma.trip.create({
          data: {
            id: trip.id,
            tripNumber: trip.tripNumber,
            vehicleId: trip.vehicleId || null,
            driverId: trip.driverId || null,
            status: trip.status || 'planned',
            notes: trip.notes || null,
            startDate: safeDate(trip.startDate),
            endDate: safeDateOrNull(trip.endDate),
            createdAt: safeDate(trip.createdAt),
            updatedAt: safeDate(trip.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.trips.length} trips imported`);
    }

    // Import Inventory
    if (exportData.inventory && exportData.inventory.length > 0) {
      console.log('📊 Importing Inventory...');
      for (const inv of exportData.inventory) {
        await prisma.inventory.create({
          data: {
            id: inv.id,
            articleId: inv.articleId,
            quantity: inv.quantity || 0,
            location: inv.location || null,
            notes: inv.notes || null,
            lastUpdate: safeDate(inv.lastUpdate),
            createdAt: safeDate(inv.createdAt),
            updatedAt: safeDate(inv.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.inventory.length} inventory records imported`);
    }

    // Import Company Settings
    if (exportData.companySettings && exportData.companySettings.length > 0) {
      console.log('⚙️  Importing Company Settings...');
      for (const setting of exportData.companySettings) {
        await prisma.companySettings.create({
          data: {
            id: setting.id,
            key: setting.key,
            value: setting.value || '',
            type: setting.type || 'string',
            category: setting.category || 'general',
            description: setting.description || null,
            createdAt: safeDate(setting.createdAt),
            updatedAt: safeDate(setting.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.companySettings.length} settings imported`);
    }

    // Import Task Notes
    if (exportData.taskNotes && exportData.taskNotes.length > 0) {
      console.log('📝 Importing Task Notes...');
      for (const note of exportData.taskNotes) {
        await prisma.taskNote.create({
          data: {
            id: note.id,
            taskId: note.taskId,
            userId: note.userId,
            content: note.content || '',
            createdAt: safeDate(note.createdAt),
            updatedAt: safeDate(note.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.taskNotes.length} task notes imported`);
    }

    // Import Holidays
    if (exportData.holidays && exportData.holidays.length > 0) {
      console.log('📅 Importing Holidays...');
      for (const holiday of exportData.holidays) {
        await prisma.holiday.create({
          data: {
            id: holiday.id,
            name: holiday.name,
            date: safeDate(holiday.date),
            type: holiday.type || 'national',
            createdAt: safeDate(holiday.createdAt),
            updatedAt: safeDate(holiday.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.holidays.length} holidays imported`);
    }

    // Import Stock Alerts
    if (exportData.stockAlerts && exportData.stockAlerts.length > 0) {
      console.log('🚨 Importing Stock Alerts...');
      for (const alert of exportData.stockAlerts) {
        await prisma.stockAlert.create({
          data: {
            id: alert.id,
            articleId: alert.articleId,
            threshold: alert.threshold || 0,
            active: safeBoolean(alert.active),
            createdAt: safeDate(alert.createdAt),
            updatedAt: safeDate(alert.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.stockAlerts.length} stock alerts imported`);
    }

    // Import Stock Movements
    if (exportData.stockMovements && exportData.stockMovements.length > 0) {
      console.log('📦 Importing Stock Movements...');
      for (const movement of exportData.stockMovements) {
        await prisma.stockMovement.create({
          data: {
            id: movement.id,
            articleId: movement.articleId,
            type: movement.type,
            quantity: movement.quantity,
            referenceId: movement.referenceId || null,
            notes: movement.notes || null,
            movementDate: safeDate(movement.movementDate),
            createdAt: safeDate(movement.createdAt),
            updatedAt: safeDate(movement.updatedAt)
          }
        });
      }
      console.log(`   ✅ ${exportData.stockMovements.length} stock movements imported`);
    }

    console.log('\n✅ Import completed successfully!');
    console.log(`📊 Total records imported: ${exportData.metadata.totalRecords}`);

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run import
importData()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    console.log('📌 Next steps:');
    console.log('   1. Verify data integrity in MariaDB');
    console.log('   2. Update .env on NAS to use MariaDB');
    console.log('   3. Rebuild and redeploy the application');
    console.log('   4. Configure automated backups with mysqldump');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
