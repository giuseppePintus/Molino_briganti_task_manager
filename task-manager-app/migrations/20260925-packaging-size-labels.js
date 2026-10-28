// One-shot: riallinea le etichette delle misure al nuovo formato in mm.
const { createPrismaClient } = require('../server/dist/lib/createPrismaClient');
const p = createPrismaClient();

(async () => {
  try {
    const n = await p.$executeRawUnsafe(
      "UPDATE `PackagingSize` SET `label` = CONCAT(`side1Mm`, 'x', `side2Mm`, 'x', `heightMm`)"
    );
    const rows = await p.$queryRawUnsafe('SELECT id, label FROM `PackagingSize`');
    console.log('AGGIORNATE:', n, JSON.stringify(rows));
  } catch (e) {
    console.log('ERR:', e.message.split('\n')[0]);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
