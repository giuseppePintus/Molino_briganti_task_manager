const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper per convertire timestamp in Date oggetto valido
function safeDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

async function importTasks() {
  console.log('📥 Starting task import to MariaDB...');

  try {
    // Leggi i dati esportati da SQLite
    const exportData = JSON.parse(
      fs.readFileSync('./sqlite-migration-export.json', 'utf8')
    );

    console.log(`📊 Found ${exportData.tasks.length} tasks to import`);

    // Importa i task
    let imported = 0;
    let skipped = 0;

    for (const task of exportData.tasks) {
      try {
        await prisma.task.create({
          data: {
            id: task.id,
            title: task.title,
            description: task.description,
            scheduledAt: safeDate(task.scheduledAt),
            assignedOperatorId: task.assignedOperatorId,
            estimatedMinutes: task.estimatedMinutes || 0,
            priority: task.priority || 'MEDIUM',
            color: task.color || '#FCD34D',
            recurring: task.recurring === 1,
            recurrenceType: task.recurrenceType,
            recurrenceEnd: safeDate(task.recurrenceEnd),
            parentTaskId: task.parentTaskId,
            createdById: task.createdById,
            createdAt: safeDate(task.createdAt) || new Date(),
            acceptedAt: safeDate(task.acceptedAt),
            acceptedById: task.acceptedById,
            paused: task.paused === 1,
            pausedAt: safeDate(task.pausedAt),
            completed: task.completed === 1,
            completedById: task.completedById,
            completedAt: safeDate(task.completedAt),
            actualMinutes: task.actualMinutes,
            assignedAt: safeDate(task.assignedAt),
          },
        });
        imported++;
        console.log(`✅ Imported task: ${task.title} (ID: ${task.id})`);
      } catch (error) {
        console.error(`❌ Failed to import task ${task.id} (${task.title}):`, error.message);
        skipped++;
      }
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Imported: ${imported} tasks`);
    console.log(`   ⚠️  Skipped: ${skipped} tasks`);

  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importTasks();
