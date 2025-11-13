import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../models/User';

const prisma = new PrismaClient();

export class AuthController {
    async login(req: Request, res: Response) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ message: 'Username and password required' });
            }

            const user = await prisma.user.findUnique({ where: { username } });
            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            const isPasswordValid = await comparePassword(password, user.passwordHash);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                process.env.JWT_SECRET as string,
                { expiresIn: '8h' }
            );

            res.json({
                message: 'Login successful',
                token,
                user: { id: user.id, username: user.username, role: user.role },
            });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async getOperators(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'master') {
                return res.status(403).json({ message: 'Only master can list operators' });
            }

            const operators = await prisma.user.findMany({
                where: { role: 'slave' },
                select: { id: true, username: true, role: true, createdAt: true },
                orderBy: { username: 'asc' },
            });

            res.json(operators);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async createOperator(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'master') {
                return res.status(403).json({ message: 'Only master can create operators' });
            }

            const { username, password, image } = req.body;

            if (!username || !password) {
                return res.status(400).json({ message: 'Username and password required' });
            }

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({ where: { username } });
            if (existingUser) {
                return res.status(400).json({ message: 'Username already exists' });
            }

            const passwordHash = await hashPassword(password);
            const user = await prisma.user.create({
                data: {
                    username,
                    passwordHash,
                    role: 'slave',
                    image: image || null,
                },
            });

            res.status(201).json({ 
                message: 'Operator created successfully', 
                user: { id: user.id, username: user.username, role: user.role, image: user.image }
            });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async deleteOperator(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'master') {
                return res.status(403).json({ message: 'Only master can delete operators' });
            }

            const operatorId = parseInt(req.params.id);

            if (!operatorId) {
                return res.status(400).json({ message: 'Operator ID required' });
            }

            // Check if operator exists
            const operator = await prisma.user.findUnique({ 
                where: { id: operatorId }
            });

            if (!operator) {
                return res.status(404).json({ message: 'Operator not found' });
            }

            if (operator.role !== 'slave') {
                return res.status(400).json({ message: 'Only slave users can be deleted' });
            }

            // First, unassign any tasks assigned to this operator
            await prisma.task.updateMany({
                where: { assignedOperatorId: operatorId },
                data: { assignedOperatorId: null }
            });

            // Delete any notes created by this operator
            await prisma.taskNote.deleteMany({
                where: { userId: operatorId }
            });

            // Delete the operator
            await prisma.user.delete({
                where: { id: operatorId }
            });

            res.json({ 
                message: 'Operator deleted successfully',
                username: operator.username
            });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async getPublicOperators(req: Request, res: Response) {
        try {
            const operators = await prisma.user.findMany({
                where: { role: 'slave' },
                select: { 
                    id: true, 
                    username: true,
                    image: true
                },
                orderBy: { username: 'asc' },
            });

            res.json(operators);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async quickLogin(req: Request, res: Response) {
        try {
            const { operatorId } = req.body;

            if (!operatorId) {
                return res.status(400).json({ message: 'Operator ID required' });
            }

            const operator = await prisma.user.findUnique({
                where: { id: parseInt(operatorId) }
            });

            if (!operator) {
                return res.status(404).json({ message: 'Operator not found' });
            }

            if (operator.role !== 'slave') {
                return res.status(403).json({ message: 'Invalid operator' });
            }

            const token = jwt.sign(
                { id: operator.id, username: operator.username, role: operator.role },
                process.env.JWT_SECRET as string,
                { expiresIn: '8h' }
            );

            res.json({
                message: 'Login successful',
                token,
                user: { id: operator.id, username: operator.username, role: operator.role },
            });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async updateOperatorImage(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'master') {
                return res.status(403).json({ message: 'Only master can update operator images' });
            }

            const operatorId = parseInt(req.params.id);
            const { image } = req.body;

            if (!operatorId) {
                return res.status(400).json({ message: 'Operator ID required' });
            }

            // Check if operator exists
            const existingOperator = await prisma.user.findUnique({ 
                where: { id: operatorId }
            });

            if (!existingOperator) {
                return res.status(404).json({ message: 'Operator not found' });
            }

            if (existingOperator.role !== 'slave') {
                return res.status(400).json({ message: 'Only slave users can be updated' });
            }

            const operator = await prisma.user.update({
                where: { id: operatorId },
                data: { image: image || null }
            });

            res.json({
                message: 'Operator image updated successfully',
                operator: { id: operator.id, username: operator.username, image: operator.image }
            });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async updateOperator(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'master') {
                return res.status(403).json({ message: 'Only master can update operators' });
            }

            const operatorId = parseInt(req.params.id);
            const { password, image } = req.body;

            if (!operatorId) {
                return res.status(400).json({ message: 'Operator ID required' });
            }

            // Check if operator exists
            const existingOperator = await prisma.user.findUnique({ 
                where: { id: operatorId }
            });

            if (!existingOperator) {
                return res.status(404).json({ message: 'Operator not found' });
            }

            if (existingOperator.role !== 'slave') {
                return res.status(400).json({ message: 'Only slave users can be updated' });
            }

            const updateData: any = {};
            
            if (password) {
                updateData.passwordHash = await hashPassword(password);
            }
            
            if (image !== undefined) {
                updateData.image = image || null;
            }

            const operator = await prisma.user.update({
                where: { id: operatorId },
                data: updateData
            });

            res.json({
                message: 'Operator updated successfully',
                operator: { id: operator.id, username: operator.username, image: operator.image }
            });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }
}