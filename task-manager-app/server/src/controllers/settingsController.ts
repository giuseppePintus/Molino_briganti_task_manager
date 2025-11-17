import { Request, Response } from 'express';

export async function getSettings(req: Request, res: Response) {
  res.json({ test: 'ok', businessName: 'Molino Briganti' });
}

export async function updateSettings(req: Request, res: Response) {
  res.json({ test: 'updated' });
}
