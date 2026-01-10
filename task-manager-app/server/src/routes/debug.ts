import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

/**
 * GET /api/debug/trip-schema
 * Mostra lo schema della tabella Trip
 */
router.get('/trip-schema', async (req: Request, res: Response) => {
  try {
    // Esegui PRAGMA table_info per ottenere lo schema della tabella Trip
    const schema = await prisma.$queryRaw`PRAGMA table_info("Trip")`;
    
    // Prendi un trip per vedere i dati reali
    const trip = await prisma.trip.findFirst({
      select: {
        id: true,
        name: true,
        accepted: true,
        acceptedAt: true,
        printed: true,
        printedAt: true
      }
    });

    res.json({
      schema,
      sampleTrip: trip,
      message: 'Mostra lo schema della tabella Trip e un sample di dati'
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message,
      hint: 'I campi accepted, acceptedAt, printed, printedAt potrebbero non esistere nel database'
    });
  }
});

export default router;
