const PrismaClient = require('@prisma/client').PrismaClient;
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    where: {
      scheduledAt: {
        gte: new Date('2025-12-22T00:00:00'),
        lt: new Date('2025-12-23T00:00:00'),
      },
    },
    include: {
      assignedOperator: true,
    },
  });

  console.log('=== TASKS FOR 2025-12-22 ===');
  console.log(`Total: ${tasks.length}`);
  tasks.forEach(t => {
    console.log(`- ID: ${t.id}, Title: "${t.title}", Assigned: ${t.assignedOperator?.name || 'NONE'}, Completed: ${t.completed}, ScheduledAt: ${t.scheduledAt}`);
  });
  
  const unassigned = tasks.filter(t => !t.assignedOperatorId);
  console.log(`\nUnassigned: ${unassigned.length}`);
  unassigned.forEach(t => {
    console.log(`- "${t.title}"`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
