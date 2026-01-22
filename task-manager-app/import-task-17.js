const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper per convertire timestamp in Date oggetto valido
function safeDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

async function importTask17() {
  console.log('📥 Importing task ID 17...');

  try {
    const task = {
      "id": 17,
      "title": "TEST OGGI",
      "description": null,
      "scheduledAt": 1767567600000,
      "assignedOperatorId": null,
      "estimatedMinutes": 500,
      "priority": "MEDIUM",
      "color": "#FCD34D",
      "recurring": 0,
      "recurrenceType": null,
      "recurrenceEnd": null,
      "parentTaskId": null,
      "createdById": 1,
      "createdAt": 1764706432779,
      "acceptedAt": 1764874618271,
      "acceptedById": 1,
      "paused": 0,
      "pausedAt": null,
      "completed": 0,
      "completedById": null,
      "completedAt": null,
      "actualMinutes": null,
      "assignedAt": null
    };

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

    console.log(`✅ Imported task: ${task.title} (ID: ${task.id})`);

  } catch (error) {
    console.error('❌ Import failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

importTask17();
