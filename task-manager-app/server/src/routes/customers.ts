import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/customers
 * Lista tutti i clienti
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, active } = req.query;
    
    const where: any = {};
    
    if (active !== undefined) {
      where.isActive = active === 'true';
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { code: { contains: search as string } },
        { city: { contains: search as string } },
        { email: { contains: search as string } }
      ];
    }
    
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    
    // Aggiungi campi italiani per compatibilità frontend
    const customersWithItalianFields = customers.map(c => ({
      ...c,
      nome: c.name,
      indirizzo: c.address,
      città: c.city,
      telefono: c.phone,
      orario_apertura: c.openingTime,
      orario_chiusura: c.closingTime,
      orario_consegna_inizio: c.deliveryStartTime,
      orario_consegna_fine: c.deliveryEndTime
    }));
    
    res.json(customersWithItalianFields);
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/customers/:id
 * Ottieni singolo cliente
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        orders: {
          orderBy: { dateTime: 'desc' },
          take: 10
        }
      }
    });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error: any) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/customers
 * Crea nuovo cliente
 * Accetta sia campi inglesi che italiani per compatibilità con frontend
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    
    // Mappa campi italiani -> inglesi per compatibilità
    const name = body.name || body.nome;
    const address = body.address || body.indirizzo;
    const city = body.city || body.città;
    const phone = body.phone || body.telefono;
    const email = body.email;
    const code = body.code || body.codice;
    const province = body.province || body.provincia;
    const cap = body.cap;
    const piva = body.piva;
    const cf = body.cf;
    const notes = body.notes || body.note;
    
    // Campi orari specifici del frontend italiano
    const openingTime = body.orario_apertura;
    const closingTime = body.orario_chiusura;
    const deliveryStartTime = body.orario_consegna_inizio;
    const deliveryEndTime = body.orario_consegna_fine;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome cliente obbligatorio' });
    }
    
    const customer = await prisma.customer.create({
      data: {
        code: code || null,
        name,
        address: address || null,
        city: city || null,
        province: province || null,
        cap: cap || null,
        phone: phone || null,
        email: email || null,
        piva: piva || null,
        cf: cf || null,
        notes: notes || null,
        openingTime: openingTime || null,
        closingTime: closingTime || null,
        deliveryStartTime: deliveryStartTime || null,
        deliveryEndTime: deliveryEndTime || null,
        isActive: true
      }
    });
    
    // Restituisci anche con campi italiani per compatibilità frontend
    const response = {
      ...customer,
      nome: customer.name,
      indirizzo: customer.address,
      città: customer.city,
      telefono: customer.phone,
      orario_apertura: customer.openingTime,
      orario_chiusura: customer.closingTime,
      orario_consegna_inizio: customer.deliveryStartTime,
      orario_consegna_fine: customer.deliveryEndTime
    };
    
    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/customers/:id
 * Aggiorna cliente
 * Accetta sia campi inglesi che italiani per compatibilità
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;
    
    const updateData: any = {};
    
    // Mappa campi italiani -> inglesi
    const name = body.name || body.nome;
    const address = body.address || body.indirizzo;
    const city = body.city || body.città;
    const phone = body.phone || body.telefono;
    const code = body.code || body.codice;
    const province = body.province || body.provincia;
    const notes = body.notes || body.note;
    const openingTime = body.openingTime || body.orario_apertura;
    const closingTime = body.closingTime || body.orario_chiusura;
    const deliveryStartTime = body.deliveryStartTime || body.orario_consegna_inizio;
    const deliveryEndTime = body.deliveryEndTime || body.orario_consegna_fine;
    
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (province !== undefined) updateData.province = province;
    if (body.cap !== undefined) updateData.cap = body.cap;
    if (phone !== undefined) updateData.phone = phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.piva !== undefined) updateData.piva = body.piva;
    if (body.cf !== undefined) updateData.cf = body.cf;
    if (notes !== undefined) updateData.notes = notes;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (openingTime !== undefined) updateData.openingTime = openingTime;
    if (closingTime !== undefined) updateData.closingTime = closingTime;
    if (deliveryStartTime !== undefined) updateData.deliveryStartTime = deliveryStartTime;
    if (deliveryEndTime !== undefined) updateData.deliveryEndTime = deliveryEndTime;
    
    const customer = await prisma.customer.update({
      where: { id: parseInt(id) },
      data: updateData
    });
    
    // Restituisci con campi italiani per compatibilità
    const response = {
      ...customer,
      nome: customer.name,
      indirizzo: customer.address,
      città: customer.city,
      telefono: customer.phone,
      orario_apertura: customer.openingTime,
      orario_chiusura: customer.closingTime,
      orario_consegna_inizio: customer.deliveryStartTime,
      orario_consegna_fine: customer.deliveryEndTime
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/customers/:id
 * Elimina cliente (soft delete - imposta isActive = false)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { hard } = req.query;
    
    if (hard === 'true') {
      // Hard delete - rimuovi completamente
      await prisma.customer.delete({
        where: { id: parseInt(id) }
      });
    } else {
      // Soft delete - imposta isActive = false
      await prisma.customer.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
      });
    }
    
    res.json({ success: true, message: 'Customer deleted' });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/customers/bulk
 * Importa clienti in blocco (per migrazione da CSV)
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { customers } = req.body;
    
    if (!Array.isArray(customers)) {
      return res.status(400).json({ error: 'customers must be an array' });
    }
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    for (const c of customers) {
      try {
        // Cerca cliente esistente per codice o nome
        const existing = c.code 
          ? await prisma.customer.findUnique({ where: { code: c.code } })
          : await prisma.customer.findFirst({ where: { name: c.name } });
        
        if (existing) {
          // Aggiorna
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              name: c.name || existing.name,
              address: c.address || c.indirizzo || existing.address,
              city: c.city || c.citta || existing.city,
              province: c.province || c.provincia || existing.province,
              cap: c.cap || existing.cap,
              phone: c.phone || c.telefono || existing.phone,
              email: c.email || existing.email,
              piva: c.piva || c.partitaIva || existing.piva,
              cf: c.cf || c.codiceFiscale || existing.cf,
              notes: c.notes || c.note || existing.notes
            }
          });
          updated++;
        } else {
          // Crea nuovo
          await prisma.customer.create({
            data: {
              code: c.code || null,
              name: c.name || c.ragioneSociale || 'Cliente senza nome',
              address: c.address || c.indirizzo || null,
              city: c.city || c.citta || null,
              province: c.province || c.provincia || null,
              cap: c.cap || null,
              phone: c.phone || c.telefono || null,
              email: c.email || null,
              piva: c.piva || c.partitaIva || null,
              cf: c.cf || c.codiceFiscale || null,
              notes: c.notes || c.note || null,
              isActive: true
            }
          });
          created++;
        }
      } catch (e) {
        errors++;
      }
    }
    
    res.status(201).json({ 
      success: true, 
      created,
      updated,
      errors,
      message: `Imported: ${created} created, ${updated} updated, ${errors} errors`
    });
  } catch (error: any) {
    console.error('Error bulk importing customers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/customers/import-csv
 * Importa clienti da CSV (dal file esistente)
 */
router.post('/import-csv', async (req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const csvPath = path.join(__dirname, '../../..', 'public/data/clienti.csv');
    
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: 'CSV file not found' });
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter((l: string) => l.trim());
    
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }
    
    const headers = lines[0].split(';').map((h: string) => h.trim().toLowerCase());
    const customers: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      const customer: any = {};
      
      headers.forEach((header: string, idx: number) => {
        customer[header] = values[idx]?.trim() || null;
      });
      
      customers.push({
        code: customer.codice || customer.code,
        name: customer.ragionesociale || customer.nome || customer.name,
        address: customer.indirizzo || customer.address,
        city: customer.citta || customer.city,
        province: customer.provincia || customer.province,
        cap: customer.cap,
        phone: customer.telefono || customer.phone,
        email: customer.email,
        piva: customer.partitaiva || customer.piva,
        cf: customer.codicefiscale || customer.cf,
        notes: customer.note || customer.notes
      });
    }
    
    // Usa bulk import
    let created = 0;
    for (const c of customers) {
      if (!c.name) continue;
      try {
        await prisma.customer.upsert({
          where: { code: c.code || `AUTO_${Date.now()}_${created}` },
          update: {
            name: c.name,
            address: c.address,
            city: c.city,
            province: c.province,
            cap: c.cap,
            phone: c.phone,
            email: c.email,
            piva: c.piva,
            cf: c.cf,
            notes: c.notes
          },
          create: {
            code: c.code || null,
            name: c.name,
            address: c.address,
            city: c.city,
            province: c.province,
            cap: c.cap,
            phone: c.phone,
            email: c.email,
            piva: c.piva,
            cf: c.cf,
            notes: c.notes,
            isActive: true
          }
        });
        created++;
      } catch (e) {
        // Skip duplicates
      }
    }
    
    res.json({ 
      success: true, 
      count: created,
      message: `${created} customers imported from CSV`
    });
  } catch (error: any) {
    console.error('Error importing CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
