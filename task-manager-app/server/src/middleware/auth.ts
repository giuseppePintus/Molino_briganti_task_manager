import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                username: string;
                role: string;
            };
        }
    }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
            id: number;
            username: string;
            role: string;
        };
        req.user = decoded;
        next();
    } catch (err: unknown) {
        return res.status(403).json({ message: 'Failed to authenticate token' });
    }
};

export const requireMaster = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== 'master') {
        return res.status(403).json({ message: 'Access denied: Master role required' });
    }
    next();
};