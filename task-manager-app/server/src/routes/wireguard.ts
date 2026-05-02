import { Router, Request, Response } from 'express';
import { authMiddleware, requireMaster } from '../middleware/auth';
import * as wg from '../services/wireguardService';

const router = Router();

router.use(authMiddleware);
router.use(requireMaster);

// Ritorna true se il backend ha accesso alla config WG (volume montato e wg0.conf presente)
router.get('/health', (_req: Request, res: Response) => {
    try {
        const peers = wg.listPeers();
        res.json({ success: true, available: true, peerCount: peers.length });
    } catch (err: any) {
        res.json({ success: true, available: false, error: err.message });
    }
});

router.get('/peers', (_req: Request, res: Response) => {
    try {
        res.json({ success: true, peers: wg.listPeers() });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/peers', async (req: Request, res: Response) => {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ success: false, error: 'name mancante' });
    }
    if (!wg.isValidPeerName(name)) {
        return res.status(400).json({ success: false, error: 'Nome non valido (solo a-z0-9, 2-24 caratteri)' });
    }
    try {
        const peer = await wg.addPeer(name);
        res.json({ success: true, peer });
    } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
    }
});

router.get('/peers/:name', (req: Request, res: Response) => {
    try {
        res.json({ success: true, peer: wg.getPeerDetail(req.params.name) });
    } catch (err: any) {
        res.status(404).json({ success: false, error: err.message });
    }
});

router.delete('/peers/:name', (req: Request, res: Response) => {
    try {
        wg.removePeer(req.params.name);
        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Download QR PNG come file
router.get('/peers/:name/qr', (req: Request, res: Response) => {
    try {
        const buf = wg.getPeerQrBuffer(req.params.name);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="peer_${req.params.name}.png"`);
        res.send(buf);
    } catch (err: any) {
        res.status(404).json({ success: false, error: err.message });
    }
});

// Download .conf
router.get('/peers/:name/conf', (req: Request, res: Response) => {
    try {
        const conf = wg.getPeerConfText(req.params.name);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="peer_${req.params.name}.conf"`);
        res.send(conf);
    } catch (err: any) {
        res.status(404).json({ success: false, error: err.message });
    }
});

export default router;
