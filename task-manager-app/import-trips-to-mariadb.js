const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper per convertire timestamp in Date oggetto valido
function safeDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

async function importTrips() {
  console.log('📥 Starting trip import to MariaDB...');

  try {
    // Leggi i dati esportati da SQLite
    const exportData = JSON.parse(
      fs.readFileSync('./sqlite-migration-export.json', 'utf8')
    );

    console.log(`📊 Found ${exportData.trips.length} trips to import`);

    // Importa i trip
    let imported = 0;
    let skipped = 0;

    for (const trip of exportData.trips) {
      try {
        await prisma.trip.create({
          data: {
            id: trip.id,
            name: trip.name,
            date: safeDate(trip.date) || new Date(),
            assignedOperatorId: trip.assignedOperatorId,
            vehicleId: trip.vehicleId,
            vehicleName: trip.vehicleName || 'Unknown',
            status: trip.status || 'planned',
            startedAt: safeDate(trip.startedAt),
            completedAt: safeDate(trip.completedAt),
            notes: trip.notes,
            createdAt: safeDate(trip.createdAt) || new Date(),
            updatedAt: safeDate(trip.updatedAt) || new Date(),
            sequence: trip.sequence,
          },
        });
        imported++;
        console.log(`✅ Imported trip: ${trip.name} (ID: ${trip.id})`);
      } catch (error) {
        console.error(`❌ Failed to import trip ${trip.id} (${trip.name}):`, error.message);
        skipped++;
      }
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Imported: ${imported} trips`);
    console.log(`   ⚠️  Skipped: ${skipped} trips`);

  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importTrips();
