process.env.DATABASE_URL = 'file:/data/molino/tasks.db';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const result = await prisma.order.deleteMany({});
  console.log('Ordini eliminati:', result.count);
  await prisma.$disconnect();
  process.exit(0);
})();
