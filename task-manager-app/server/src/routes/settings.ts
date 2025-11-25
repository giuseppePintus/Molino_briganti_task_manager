import { Router } from 'express';
import { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Tutte le route richiedono autenticazione
router.use(authMiddleware);

// GET settings
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'master') {
      return res.status(403).json({ message: 'Only master can view settings' });
    }

    // Ritorna configurazioni di default
    res.json({
      company: {
        name: 'Molino Briganti',
        email: 'info@molinobriganti.it',
        phone: '+39 XXX XXX XXXX',
        address: 'Via Molino Briganti, X, Italia',
      },
      backup: {
        enabled: true,
        interval: 60,
        retention: 30,
      },
      notifications: {
        email: true,
        sms: false,
        push: true,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message: errorMsg });
  }
});

// UPDATE settings
router.put('/', async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'master') {
      return res.status(403).json({ message: 'Only master can update settings' });
    }

    // Salva le nuove impostazioni (in produzione salvare su database)
    const { company, backup, notifications } = req.body;

    res.json({
      message: 'Settings updated successfully',
      data: {
        company,
        backup,
        notifications,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message: errorMsg });
  }
});

export default router;
