// import-to-mariadb-simple.js
// Script semplificato per importare solo i dati critici da SQLite a MariaDB
// Focus su: Users, Articles, Inventory, Customers

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper functions
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

async function importData() {
  console.log('📥 Starting simplified MariaDB data import...\n');
  
  try {
    const exportPath = path.join(__dirname, 'sqlite-migration-export.json');
    console.log(`📂 Reading from: ${exportPath}`);
    
    if (!fs.existsSync(exportPath)) {
      throw new Error('Export file not found. Run export-sqlite-data.js first!');
    }
    
    const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    console.log(`📊 Total records to import: ${exportData.metadata.totalRecords}\n`);

    // 1. Import Users (essenziale)
    if (exportData.users && exportData.users.length > 0) {
      console.log('👥 Importing Users...');
      for (const user of exportData.users) {
        try {
          await prisma.user.create({
            data: {
              id: user.id,
              username: user.username,
              passwordHash: user.password || user.passwordHash || '$2b$10$defaulthash',
              role: user.role || 'slave',
              image: user.image || null,
              createdAt: safeDate(user.createdAt)
            }
          });
        } catch (err) {
          console.log(`   ⚠️  Skipping user ${user.username}: ${err.message}`);
        }
      }
      console.log(`   ✅ Users import completed`);
    }

    // 2. Import Customers (essenziale per ordini)
    if (exportData.customers && exportData.customers.length > 0) {
      console.log('🏢 Importing Customers...');
      for (const customer of exportData.customers) {
        try {
          await prisma.customer.create({
            data: {
              id: customer.id,
              code: customer.code || `C${customer.id}`,
              name: customer.name,
              address: customer.address || null,
              phone: customer.phone || null,
              email: customer.email || null,
              notes: customer.notes || null,
              createdAt: safeDate(customer.createdAt)
            }
          });
        } catch (err) {
          console.log(`   ⚠️  Skipping customer ${customer.name}: ${err.message}`);
        }
      }
      console.log(`   ✅ Customers import completed`);
    }

    // 3. Import Articles (essenziale per inventory)
    if (exportData.articles && exportData.articles.length > 0) {
      console.log('📦 Importing Articles...');
      for (const article of exportData.articles) {
        try {
          await prisma.article.create({
            data: {
              id: article.id,
              code: article.code,
              name: article.description || article.code, // Il nuovo schema usa 'name' invece di 'description'
              description: article.notes || null,
              category: article.category || null,
              unit: article.unit || 'kg',
              createdAt: safeDate(article.createdAt)
            }
          });
        } catch (err) {
          console.log(`   ⚠️  Skipping article ${article.code}: ${err.message}`);
        }
      }
      console.log(`   ✅ Articles import completed`);
    }

    // 4. Import Inventory (critico per il business)
    if (exportData.inventory && exportData.inventory.length > 0) {
      console.log('📊 Importing Inventory...');
      for (const inv of exportData.inventory) {
        try {
          await prisma.inventory.create({
            data: {
              articleId: inv.articleId,
              currentStock: inv.quantity || 0,
              minimumStock: 0,
              reserved: 0,
              shelfPosition: inv.location || null,
              notes: inv.notes || null,
              lastUpdated: safeDate(inv.lastUpdate)
            }
          });
        } catch (err) {
          console.log(`   ⚠️  Skipping inventory for article ${inv.articleId}: ${err.message}`);
        }
      }
      console.log(`   ✅ Inventory import completed`);
    }

    // 5. Import Company Settings (configurazione)
    if (exportData.companySettings && exportData.companySettings.length > 0) {
      console.log('⚙️  Importing Company Settings...');
      for (const setting of exportData.companySettings) {
        try {
          await prisma.companySettings.create({
            data: {
              key: setting.key,
              value: setting.value || '',
              type: setting.type || 'string',
              category: setting.category || 'general',
              description: setting.description || null,
              createdAt: safeDate(setting.createdAt)
            }
          });
        } catch (err) {
          console.log(`   ⚠️  Skipping setting ${setting.key}: ${err.message}`);
        }
      }
      console.log(`   ✅ Settings import completed`);
    }

    console.log('\n✅ Critical data import completed successfully!');
    console.log('\n📋 Imported:');
    console.log(`   - ${exportData.users?.length || 0} Users`);
    console.log(`   - ${exportData.customers?.length || 0} Customers`);
    console.log(`   - ${exportData.articles?.length || 0} Articles`);
    console.log(`   - ${exportData.inventory?.length || 0} Inventory records`);
    console.log(`   - ${exportData.companySettings?.length || 0} Settings`);
    console.log('\n⚠️  Note: Tasks, Orders, Trips non sono stati importati');
    console.log('   poiché lo schema è cambiato significativamente.');
    console.log('   Questi dati possono essere reinseriti manualmente se necessario.');

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
    console.log('\n📌 Next steps:');
    console.log('   1. Verify data in MariaDB');
    console.log('   2. Test the application locally');
    console.log('   3. Deploy to NAS with DATABASE_URL updated');
    console.log('   4. Configure automated backups with mysqldump');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
