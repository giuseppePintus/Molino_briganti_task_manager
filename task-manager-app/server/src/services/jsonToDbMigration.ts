import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { DEFAULT_CATEGORIES } from '../routes/categories';

/**
 * Bootstrap one-shot per la migrazione da JSON a DB.
 * - Se ProductCategory è vuota: importa da /app/data/categories.json o usa DEFAULT_CATEGORIES.
 * - Se Customer è vuota: importa da /app/data/customers.json (se presente con dati).
 *
 * Operazione idempotente: se il DB ha già dati, non fa nulla.
 * Dopo l'importazione rinomina i file JSON in *.migrated.json per evitare doppio import.
 */

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');

interface CategoryJson {
  name: string;
  icon?: string | null;
  color?: string | null;
}

interface DestinationJson {
  id?: number;
  label: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  cap?: string | null;
  phone?: string | null;
  notes?: string | null;
  openMorningStart?: string | null;
  openMorningEnd?: string | null;
  openAfternoonStart?: string | null;
  openAfternoonEnd?: string | null;
  deliveryMorningStart?: string | null;
  deliveryMorningEnd?: string | null;
  deliveryAfternoonStart?: string | null;
  deliveryAfternoonEnd?: string | null;
}

interface CustomerJson {
  id?: number;
  code?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  cap?: string | null;
  phone?: string | null;
  email?: string | null;
  piva?: string | null;
  cf?: string | null;
  notes?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  deliveryStartTime?: string | null;
  deliveryEndTime?: string | null;
  destinations?: DestinationJson[];
  isActive?: boolean;
}

function archiveJsonFile(file: string): void {
  try {
    if (fs.existsSync(file)) {
      const target = file.replace(/\.json$/i, `.migrated-${Date.now()}.json`);
      fs.renameSync(file, target);
      console.log(`📦 [migrazione] Archiviato ${file} → ${target}`);
    }
  } catch (e: any) {
    console.warn(`⚠️ [migrazione] Impossibile archiviare ${file}:`, e.message);
  }
}

async function migrateCategories(): Promise<void> {
  const count = await prisma.productCategory.count();
  if (count > 0) {
    return; // già popolato
  }

  let items: CategoryJson[] = [];
  if (fs.existsSync(CATEGORIES_FILE)) {
    try {
      const raw = fs.readFileSync(CATEGORIES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        items = parsed;
        console.log(`📥 [migrazione] Trovate ${items.length} categorie in ${CATEGORIES_FILE}`);
      }
    } catch (e: any) {
      console.warn(`⚠️ [migrazione] Errore lettura ${CATEGORIES_FILE}:`, e.message);
    }
  }

  if (items.length === 0) {
    items = DEFAULT_CATEGORIES.map(c => ({ ...c }));
    console.log(`📦 [migrazione] Uso DEFAULT_CATEGORIES (${items.length})`);
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || !it.name) continue;
    const name = String(it.name).trim().toUpperCase();
    if (!name) continue;
    try {
      await prisma.productCategory.create({
        data: {
          name,
          icon: typeof it.icon === 'string' ? it.icon : null,
          color: typeof it.color === 'string' ? it.color : null,
          sortOrder: i
        }
      });
    } catch (e: any) {
      // Probabilmente duplicato (race), ignoro
    }
  }
  console.log(`✅ [migrazione] ProductCategory popolata`);

  archiveJsonFile(CATEGORIES_FILE);
}

async function migrateCustomers(): Promise<void> {
  const count = await prisma.customer.count();
  if (count > 0) {
    return; // già popolato
  }

  if (!fs.existsSync(CUSTOMERS_FILE)) {
    return; // niente da migrare
  }

  let items: CustomerJson[] = [];
  try {
    const raw = fs.readFileSync(CUSTOMERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) items = parsed;
  } catch (e: any) {
    console.warn(`⚠️ [migrazione] Errore lettura ${CUSTOMERS_FILE}:`, e.message);
    return;
  }

  if (items.length === 0) {
    archiveJsonFile(CUSTOMERS_FILE);
    return;
  }

  console.log(`📥 [migrazione] Trovati ${items.length} clienti in ${CUSTOMERS_FILE}`);

  let imported = 0;
  for (const c of items) {
    if (!c || !c.name) continue;
    try {
      await prisma.customer.create({
        data: {
          code: c.code ?? null,
          name: c.name,
          address: c.address ?? null,
          city: c.city ?? null,
          province: c.province ?? null,
          cap: c.cap ?? null,
          phone: c.phone ?? null,
          email: c.email ?? null,
          piva: c.piva ?? null,
          cf: c.cf ?? null,
          notes: c.notes ?? null,
          openingTime: c.openingTime ?? null,
          closingTime: c.closingTime ?? null,
          deliveryStartTime: c.deliveryStartTime ?? null,
          deliveryEndTime: c.deliveryEndTime ?? null,
          isActive: c.isActive !== false,
          destinations: c.destinations && c.destinations.length
            ? {
                create: c.destinations.map(d => ({
                  label: d.label || 'Destinazione',
                  address: d.address ?? null,
                  city: d.city ?? null,
                  province: d.province ?? null,
                  cap: d.cap ?? null,
                  phone: d.phone ?? null,
                  notes: d.notes ?? null,
                  openMorningStart: d.openMorningStart ?? null,
                  openMorningEnd: d.openMorningEnd ?? null,
                  openAfternoonStart: d.openAfternoonStart ?? null,
                  openAfternoonEnd: d.openAfternoonEnd ?? null,
                  deliveryMorningStart: d.deliveryMorningStart ?? null,
                  deliveryMorningEnd: d.deliveryMorningEnd ?? null,
                  deliveryAfternoonStart: d.deliveryAfternoonStart ?? null,
                  deliveryAfternoonEnd: d.deliveryAfternoonEnd ?? null
                }))
              }
            : undefined
        }
      });
      imported++;
    } catch (e: any) {
      console.warn(`⚠️ [migrazione] Cliente "${c.name}" saltato:`, e.message);
    }
  }
  console.log(`✅ [migrazione] Importati ${imported}/${items.length} clienti`);

  archiveJsonFile(CUSTOMERS_FILE);
}

export async function migrateJsonToDb(): Promise<void> {
  try {
    await migrateCategories();
  } catch (e: any) {
    console.error('❌ [migrazione] migrateCategories fallita:', e.message);
  }
  try {
    await migrateCustomers();
  } catch (e: any) {
    console.error('❌ [migrazione] migrateCustomers fallita:', e.message);
  }
}
