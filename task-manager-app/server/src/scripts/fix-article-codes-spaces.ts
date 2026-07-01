/**
 * Script one-shot: corregge i codici articolo che contengono spazi nel DB.
 * Rimuove tutti gli spazi (es. "F-BIO- 00 PIZZA-10KG" → "F-BIO-00PIZZA-10KG").
 *
 * Esegui con:
 *   npx ts-node src/scripts/fix-article-codes-spaces.ts
 *   oppure, se disponibile:
 *   npx tsx src/scripts/fix-article-codes-spaces.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Cerca tutti gli articoli con almeno uno spazio nel codice
  const articles = await prisma.article.findMany({
    where: { code: { contains: ' ' } },
    select: { id: true, code: true, name: true }
  });

  if (articles.length === 0) {
    console.log('✅ Nessun codice articolo con spazi trovato. Nessuna modifica necessaria.');
    return;
  }

  console.log(`⚠️  Trovati ${articles.length} articoli con spazi nel codice:\n`);

  for (const article of articles) {
    const fixedCode = article.code.replace(/\s+/g, '');
    console.log(`  ID ${article.id} | "${article.code}" → "${fixedCode}" (${article.name})`);
  }

  console.log('\nAvvio correzione...\n');

  let fixed = 0;
  let errors = 0;

  for (const article of articles) {
    const fixedCode = article.code.replace(/\s+/g, '');
    try {
      await prisma.article.update({
        where: { id: article.id },
        data: { code: fixedCode }
      });
      console.log(`  ✅ ID ${article.id} aggiornato: "${article.code}" → "${fixedCode}"`);
      fixed++;
    } catch (err: any) {
      console.error(`  ❌ ID ${article.id} errore: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nRiepilogo: ${fixed} aggiornati, ${errors} errori.`);
}

main()
  .catch(e => {
    console.error('Errore fatale:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
