/**
 * Script per importare i dati dal backup nel database Prisma del container
 */
const fs = require('fs');
const path = require('path');

// Load .env file manually
require('dotenv').config({ path: '/app/.env' });

// Fallback DATABASE_URL if not in env
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:/app/server/prisma/prisma/data/tasks.db';
  console.log('📝 DATABASE_URL set from fallback');
}

console.log(`🔗 Using DATABASE_URL: ${process.env.DATABASE_URL}`);

// Import Prisma client dinamicamente
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function importBackupData() {
  console.log('=== IMPORT DATI DAL BACKUP ===\n');
  
  try {
    // Leggi i dati esportati
    const backupFile = '/app/backups/backup_complete_export.json';
    
    if (!fs.existsSync(backupFile)) {
      console.log(`⚠️  File di backup non trovato: ${backupFile}`);
      console.log('Cercando il file nella directory locale...');
      process.exit(1);
    }
    
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
    
    // 1. Import ARTICOLI
    console.log('1️⃣  Importazione ARTICOLI...');
    const articles = backupData.Article || [];
    let articleCount = 0;
    
    for (const article of articles) {
      try {
        await prisma.article.upsert({
          where: { codiceArticolo: article.codiceArticolo },
          update: {
            descrizioneBreveMaterial: article.descrizioneBreveMaterial,
            descrizioneArticolo: article.descrizioneArticolo,
            unitaMisura: article.unitaMisura,
            categoria: article.categoria,
            sottocategoria: article.sottocategoria,
            prezzo: article.prezzo,
            peso: article.peso,
          },
          create: {
            codiceArticolo: article.codiceArticolo,
            descrizioneBreveMaterial: article.descrizioneBreveMaterial,
            descrizioneArticolo: article.descrizioneArticolo,
            unitaMisura: article.unitaMisura || 'PZ',
            categoria: article.categoria,
            sottocategoria: article.sottocategoria,
            prezzo: article.prezzo,
            peso: article.peso,
          }
        });
        articleCount++;
        console.log(`   ✓ ${article.codiceArticolo} - ${article.descrizioneArticolo?.substring(0, 50)}`);
      } catch (error) {
        console.log(`   ✗ ${article.codiceArticolo}: ${error.message}`);
      }
    }
    
    console.log(`   Total imported: ${articleCount}/${articles.length}\n`);
    
    // 2. Import INVENTORY
    console.log('2️⃣  Importazione INVENTORY...');
    const inventories = backupData.Inventory || [];
    let inventoryCount = 0;
    
    for (const inv of inventories) {
      try {
        // First find the article by ID
        const article = await prisma.article.findUnique({
          where: { id: inv.articoloId }
        });
        
        if (!article) {
          console.log(`   ⚠️  Articolo non trovato: ${inv.articoloId}`);
          continue;
        }
        
        await prisma.inventory.upsert({
          where: { articoloId: inv.articoloId },
          update: {
            quantita: inv.quantita || 0,
            scaffale: inv.scaffale,
            posizione: inv.posizione,
          },
          create: {
            articoloId: inv.articoloId,
            quantita: inv.quantita || 0,
            scaffale: inv.scaffale,
            posizione: inv.posizione,
          }
        });
        inventoryCount++;
      } catch (error) {
        console.log(`   ✗ Inventory ${inv.articoloId}: ${error.message}`);
      }
    }
    
    console.log(`   Total imported: ${inventoryCount}/${inventories.length}\n`);
    
    // 3. Import TASK
    console.log('3️⃣  Importazione TASK...');
    const tasks = backupData.Task || [];
    let taskCount = 0;
    
    for (const task of tasks) {
      try {
        await prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            priority: task.priority || 'MEDIUM',
            color: task.color || '#FCD34D',
            estimatedMinutes: task.estimatedMinutes,
            createdById: 1, // Admin user
          }
        });
        taskCount++;
        console.log(`   ✓ ${task.title}`);
      } catch (error) {
        console.log(`   ✗ ${task.title}: ${error.message}`);
      }
    }
    
    console.log(`   Total imported: ${taskCount}/${tasks.length}\n`);
    
    console.log('='.repeat(50));
    console.log('✅ IMPORT COMPLETED');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Errore durante l\'import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importBackupData();
