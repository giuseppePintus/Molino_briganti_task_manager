import { Router } from 'express';
import { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Default company settings
const defaultSettings = {
  businessName: 'Molino Briganti',
  logoUrl: 'images/logo INSEGNA.png',
  openingDays: [1,2,3,4,5,6],
  openMorningStart: '08:00',
  openMorningEnd: '13:00',
  openAfternoonStart: '15:00',
  openAfternoonEnd: '18:00',
  openSatMorningStart: '08:00',
  openSatMorningEnd: '12:00',
  openSatAfternoonStart: '',
  openSatAfternoonEnd: '',
  deliveryDays: [1,2,3,4,5,6],
  deliveryMorningStart: '08:00',
  deliveryMorningEnd: '12:00',
  deliveryAfternoonStart: '15:00',
  deliveryAfternoonEnd: '18:00',
  deliverySatMorningStart: '08:00',
  deliverySatMorningEnd: '12:00',
  deliverySatAfternoonStart: '',
  deliverySatAfternoonEnd: ''
};

/**
 * GET /api/settings/company
 * Ottieni tutte le impostazioni aziendali dal database
 */
router.get('/company', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.companySettings.findMany();
    
    // Converti array di key-value in oggetto
    const result: any = { ...defaultSettings };
    
    for (const setting of settings) {
      try {
        result[setting.key] = JSON.parse(setting.value);
      } catch {
        result[setting.key] = setting.value;
      }
    }
    
    // Carica veicoli
    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' }
    });
    result.vehicles = vehicles;
    
    // Carica festivi
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: 'asc' }
    });
    result.holidays = holidays.map(h => h.date.toISOString().split('T')[0]);
    
    res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    console.error('Error fetching company settings:', errorMsg);
    res.status(500).json({ message: errorMsg });
  }
});

/**
 * PUT /api/settings/company
 * Salva tutte le impostazioni aziendali nel database
 */
router.put('/company', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'master') {
      return res.status(403).json({ message: 'Only master can update settings' });
    }
    
    const { 
      businessName, logoUrl,
      openingDays, openMorningStart, openMorningEnd, openAfternoonStart, openAfternoonEnd,
      openSatMorningStart, openSatMorningEnd, openSatAfternoonStart, openSatAfternoonEnd,
      deliveryDays, deliveryMorningStart, deliveryMorningEnd, deliveryAfternoonStart, deliveryAfternoonEnd,
      deliverySatMorningStart, deliverySatMorningEnd, deliverySatAfternoonStart, deliverySatAfternoonEnd,
      holidays, vehicles
    } = req.body;
    
    // Salva impostazioni come key-value
    const settingsToSave: { key: string, value: string }[] = [
      { key: 'businessName', value: JSON.stringify(businessName) },
      { key: 'logoUrl', value: JSON.stringify(logoUrl) },
      { key: 'openingDays', value: JSON.stringify(openingDays) },
      { key: 'openMorningStart', value: JSON.stringify(openMorningStart) },
      { key: 'openMorningEnd', value: JSON.stringify(openMorningEnd) },
      { key: 'openAfternoonStart', value: JSON.stringify(openAfternoonStart) },
      { key: 'openAfternoonEnd', value: JSON.stringify(openAfternoonEnd) },
      { key: 'openSatMorningStart', value: JSON.stringify(openSatMorningStart) },
      { key: 'openSatMorningEnd', value: JSON.stringify(openSatMorningEnd) },
      { key: 'openSatAfternoonStart', value: JSON.stringify(openSatAfternoonStart) },
      { key: 'openSatAfternoonEnd', value: JSON.stringify(openSatAfternoonEnd) },
      { key: 'deliveryDays', value: JSON.stringify(deliveryDays) },
      { key: 'deliveryMorningStart', value: JSON.stringify(deliveryMorningStart) },
      { key: 'deliveryMorningEnd', value: JSON.stringify(deliveryMorningEnd) },
      { key: 'deliveryAfternoonStart', value: JSON.stringify(deliveryAfternoonStart) },
      { key: 'deliveryAfternoonEnd', value: JSON.stringify(deliveryAfternoonEnd) },
      { key: 'deliverySatMorningStart', value: JSON.stringify(deliverySatMorningStart) },
      { key: 'deliverySatMorningEnd', value: JSON.stringify(deliverySatMorningEnd) },
      { key: 'deliverySatAfternoonStart', value: JSON.stringify(deliverySatAfternoonStart) },
      { key: 'deliverySatAfternoonEnd', value: JSON.stringify(deliverySatAfternoonEnd) }
    ];
    
    // Upsert ogni impostazione
    for (const setting of settingsToSave) {
      if (setting.value !== undefined && setting.value !== 'undefined') {
        await prisma.companySettings.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: { key: setting.key, value: setting.value }
        });
      }
    }
    
    // Gestisci veicoli
    if (Array.isArray(vehicles)) {
      // Disattiva tutti i veicoli esistenti
      await prisma.vehicle.updateMany({
        data: { isActive: false }
      });
      
      // Crea/aggiorna veicoli usando upsert per evitare errori
      for (const v of vehicles) {
        if (v.id && typeof v.id === 'number') {
          // Prova prima a trovare il veicolo, se non esiste crealo
          const existingVehicle = await prisma.vehicle.findUnique({
            where: { id: v.id }
          });
          
          if (existingVehicle) {
            await prisma.vehicle.update({
              where: { id: v.id },
              data: { name: v.name, isActive: true }
            });
          } else {
            // L'ID non esiste nel DB, crea un nuovo veicolo
            await prisma.vehicle.create({
              data: { name: v.name, isActive: true }
            });
          }
        } else {
          await prisma.vehicle.create({
            data: { name: v.name, isActive: true }
          });
        }
      }
    }
    
    // Gestisci festivi
    if (Array.isArray(holidays)) {
      // Elimina tutti i festivi esistenti
      await prisma.holiday.deleteMany({});
      
      // Crea nuovi festivi
      for (const dateStr of holidays) {
        await prisma.holiday.create({
          data: { date: new Date(dateStr + 'T00:00:00Z') }
        });
      }
    }
    
    res.json({ message: 'Settings saved successfully' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    console.error('Error saving company settings:', errorMsg);
    res.status(500).json({ message: errorMsg });
  }
});

// GET settings legacy - disponibile a tutti gli utenti autenticati (compatibilità)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Prova a caricare dal database
    const settings = await prisma.companySettings.findMany();
    
    if (settings.length > 0) {
      const result: any = { ...defaultSettings };
      for (const setting of settings) {
        try {
          result[setting.key] = JSON.parse(setting.value);
        } catch {
          result[setting.key] = setting.value;
        }
      }
      
      // Carica veicoli
      const vehicles = await prisma.vehicle.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' }
      });
      result.vehicles = vehicles;
      
      // Carica festivi
      const holidays = await prisma.holiday.findMany({
        orderBy: { date: 'asc' }
      });
      result.holidays = holidays.map(h => h.date.toISOString().split('T')[0]);
      
      return res.json(result);
    }
    
    // Fallback ai default
    res.json(defaultSettings);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message: errorMsg });
  }
});

// UPDATE settings legacy - solo master (compatibilità)
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'master') {
      return res.status(403).json({ message: 'Only master can update settings' });
    }
    
    const { 
      businessName, logoUrl,
      openingDays, openMorningStart, openMorningEnd, openAfternoonStart, openAfternoonEnd,
      openSatMorningStart, openSatMorningEnd, openSatAfternoonStart, openSatAfternoonEnd,
      deliveryDays, deliveryMorningStart, deliveryMorningEnd, deliveryAfternoonStart, deliveryAfternoonEnd,
      deliverySatMorningStart, deliverySatMorningEnd, deliverySatAfternoonStart, deliverySatAfternoonEnd,
      holidays, vehicles
    } = req.body;
    
    // Salva impostazioni come key-value
    const settingsToSave: { key: string, value: string }[] = [];
    
    if (businessName !== undefined) settingsToSave.push({ key: 'businessName', value: JSON.stringify(businessName) });
    if (logoUrl !== undefined) settingsToSave.push({ key: 'logoUrl', value: JSON.stringify(logoUrl) });
    if (openingDays !== undefined) settingsToSave.push({ key: 'openingDays', value: JSON.stringify(openingDays) });
    if (openMorningStart !== undefined) settingsToSave.push({ key: 'openMorningStart', value: JSON.stringify(openMorningStart) });
    if (openMorningEnd !== undefined) settingsToSave.push({ key: 'openMorningEnd', value: JSON.stringify(openMorningEnd) });
    if (openAfternoonStart !== undefined) settingsToSave.push({ key: 'openAfternoonStart', value: JSON.stringify(openAfternoonStart) });
    if (openAfternoonEnd !== undefined) settingsToSave.push({ key: 'openAfternoonEnd', value: JSON.stringify(openAfternoonEnd) });
    if (openSatMorningStart !== undefined) settingsToSave.push({ key: 'openSatMorningStart', value: JSON.stringify(openSatMorningStart) });
    if (openSatMorningEnd !== undefined) settingsToSave.push({ key: 'openSatMorningEnd', value: JSON.stringify(openSatMorningEnd) });
    if (openSatAfternoonStart !== undefined) settingsToSave.push({ key: 'openSatAfternoonStart', value: JSON.stringify(openSatAfternoonStart) });
    if (openSatAfternoonEnd !== undefined) settingsToSave.push({ key: 'openSatAfternoonEnd', value: JSON.stringify(openSatAfternoonEnd) });
    if (deliveryDays !== undefined) settingsToSave.push({ key: 'deliveryDays', value: JSON.stringify(deliveryDays) });
    if (deliveryMorningStart !== undefined) settingsToSave.push({ key: 'deliveryMorningStart', value: JSON.stringify(deliveryMorningStart) });
    if (deliveryMorningEnd !== undefined) settingsToSave.push({ key: 'deliveryMorningEnd', value: JSON.stringify(deliveryMorningEnd) });
    if (deliveryAfternoonStart !== undefined) settingsToSave.push({ key: 'deliveryAfternoonStart', value: JSON.stringify(deliveryAfternoonStart) });
    if (deliveryAfternoonEnd !== undefined) settingsToSave.push({ key: 'deliveryAfternoonEnd', value: JSON.stringify(deliveryAfternoonEnd) });
    if (deliverySatMorningStart !== undefined) settingsToSave.push({ key: 'deliverySatMorningStart', value: JSON.stringify(deliverySatMorningStart) });
    if (deliverySatMorningEnd !== undefined) settingsToSave.push({ key: 'deliverySatMorningEnd', value: JSON.stringify(deliverySatMorningEnd) });
    if (deliverySatAfternoonStart !== undefined) settingsToSave.push({ key: 'deliverySatAfternoonStart', value: JSON.stringify(deliverySatAfternoonStart) });
    if (deliverySatAfternoonEnd !== undefined) settingsToSave.push({ key: 'deliverySatAfternoonEnd', value: JSON.stringify(deliverySatAfternoonEnd) });
    
    // Upsert ogni impostazione
    for (const setting of settingsToSave) {
      await prisma.companySettings.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: { key: setting.key, value: setting.value }
      });
    }
    
    // Gestisci veicoli
    if (Array.isArray(vehicles)) {
      await prisma.vehicle.updateMany({ data: { isActive: false } });
      for (const v of vehicles) {
        if (v.id) {
          await prisma.vehicle.update({
            where: { id: v.id },
            data: { name: v.name, isActive: true }
          });
        } else {
          await prisma.vehicle.create({
            data: { name: v.name, isActive: true }
          });
        }
      }
    }
    
    // Gestisci festivi
    if (Array.isArray(holidays)) {
      await prisma.holiday.deleteMany({});
      for (const dateStr of holidays) {
        await prisma.holiday.create({
          data: { date: new Date(dateStr + 'T00:00:00Z') }
        });
      }
    }
    
    res.json({ message: 'Settings saved successfully' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    console.error('Error saving settings:', errorMsg);
    res.status(500).json({ message: errorMsg });
  }
});

/**
 * GET /api/settings/vehicles
 * Lista veicoli
 */
router.get('/vehicles', async (req: Request, res: Response) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' }
    });
    res.json(vehicles);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message: errorMsg });
  }
});

/**
 * POST /api/settings/vehicles
 * Crea veicolo
 */
router.post('/vehicles', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'master') {
      return res.status(403).json({ message: 'Only master can add vehicles' });
    }
    
    const { name, plate } = req.body;
    
    const vehicle = await prisma.vehicle.create({
      data: { name, plate: plate || null, isActive: true }
    });
    
    res.status(201).json(vehicle);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message: errorMsg });
  }
});

/**
 * DELETE /api/settings/vehicles/:id
 * Elimina veicolo
 */
router.delete('/vehicles/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'master') {
      return res.status(403).json({ message: 'Only master can delete vehicles' });
    }
    
    const { id } = req.params;
    
    await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });
    
    res.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message: errorMsg });
  }
});

/**
 * GET /api/settings/holidays
 * Lista festivi
 */
router.get('/holidays', async (req: Request, res: Response) => {
  try {
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: 'asc' }
    });
    res.json(holidays.map(h => ({
      id: h.id,
      date: h.date.toISOString().split('T')[0],
      description: h.description
    })));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message: errorMsg });
  }
});

/**
 * POST /api/settings/holidays
 * Aggiungi festivo
 */
router.post('/holidays', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'master') {
      return res.status(403).json({ message: 'Only master can add holidays' });
    }
    
    const { date, description } = req.body;
    
    const holiday = await prisma.holiday.create({
      data: { 
        date: new Date(date + 'T00:00:00Z'),
        description: description || null
      }
    });
    
    res.status(201).json({
      id: holiday.id,
      date: holiday.date.toISOString().split('T')[0],
      description: holiday.description
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message: errorMsg });
  }
});

/**
 * DELETE /api/settings/holidays/:id
 * Elimina festivo
 */
router.delete('/holidays/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'master') {
      return res.status(403).json({ message: 'Only master can delete holidays' });
    }
    
    const { id } = req.params;
    
    await prisma.holiday.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message: errorMsg });
  }
});

export default router;
