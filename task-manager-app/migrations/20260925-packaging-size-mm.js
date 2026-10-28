// One-shot: converte PackagingSize da cm a mm senza perdita dati.
const { createPrismaClient } = require('../server/dist/lib/createPrismaClient');
const p = createPrismaClient();

const steps = [
  "ALTER TABLE `PackagingSize` ADD COLUMN `side1Mm` INT NOT NULL DEFAULT 0, ADD COLUMN `side2Mm` INT NOT NULL DEFAULT 0, ADD COLUMN `heightMm` INT NOT NULL DEFAULT 0",
  "UPDATE `PackagingSize` SET `side1Mm` = ROUND(`side1Cm` * 10), `side2Mm` = ROUND(`side2Cm` * 10), `heightMm` = ROUND(`heightCm` * 10)",
  "ALTER TABLE `PackagingSize` DROP COLUMN `side1Cm`, DROP COLUMN `side2Cm`, DROP COLUMN `heightCm`, ALTER COLUMN `side1Mm` DROP DEFAULT, ALTER COLUMN `side2Mm` DROP DEFAULT, ALTER COLUMN `heightMm` DROP DEFAULT",
];

(async () => {
  try {
    for (const sql of steps) {
      await p.$executeRawUnsafe(sql);
      console.log('OK:', sql.slice(0, 60) + '...');
    }
    const rows = await p.$queryRawUnsafe('SELECT id, label, side1Mm, side2Mm, heightMm, capacityKg FROM `PackagingSize`');
    console.log('RESULT:', JSON.stringify(rows));
  } catch (e) {
    console.log('ERR:', e.message.split('\n')[0]);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
