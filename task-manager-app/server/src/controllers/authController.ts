import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../models/User';

export class AuthController {
    // Verifica token e restituisce utente corrente
    async getCurrentUser(req: Request, res: Response) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: 'Not authenticated' });
            }

            // Verifica che l'utente esista ancora nel database
            const user = await prisma.user.findUnique({ 
                where: { id: req.user.id },
                select: { id: true, username: true, role: true }
            });

            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }

            res.json({ user });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ message: 'Username and password required' });
            }

            console.log(`🔐 Login attempt: username="${username}"`);
            
            const user = await prisma.user.findUnique({ where: { username } });
            if (!user) {
                console.log(`❌ User not found: ${username}`);
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            console.log(`✅ User found: ${user.username} (role: ${user.role})`);
            
            // Compare password with hash
            const isPasswordValid = await comparePassword(password, user.passwordHash);
            
            if (!isPasswordValid) {
                console.log(`❌ Password mismatch for user: ${username}`);
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
                user: { id: user.id, username: user.username, role: user.role, image: user.image },
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
                select: { id: true, username: true, role: true, createdAt: true, image: true },
                orderBy: { username: 'asc' },
            });

            res.json(operators);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async getAdmins(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'master') {
                return res.status(403).json({ message: 'Only master can list admins' });
            }

            // Includiamo anche l'admin loggato così può modificare i propri dati
            // (la cancellazione di sé è comunque bloccata in deleteOperator)
            const admins = await prisma.user.findMany({
                where: { role: 'master' },
                select: { id: true, username: true, role: true, createdAt: true, image: true },
                orderBy: { username: 'asc' },
            });

            res.json(admins);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async getAllUsersForAssignment(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'master') {
                return res.status(403).json({ message: 'Only master can list users' });
            }

            const users = await prisma.user.findMany({
                where: {
                    OR: [
                        { role: 'slave' },
                        { role: 'master', id: { not: req.user.id } }
                    ]
                },
                select: { id: true, username: true, role: true, createdAt: true, image: true },
                orderBy: { username: 'asc' },
            });

            res.json(users);
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

    async createAdmin(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'master') {
                return res.status(403).json({ message: 'Only master can create admins' });
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
                    role: 'master',
                    image: image || null,
                },
            });

            res.status(201).json({ 
                message: 'Admin created successfully', 
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
                return res.status(403).json({ message: 'Only master can delete users' });
            }

            const operatorId = parseInt(req.params.id);

            if (!operatorId) {
                return res.status(400).json({ message: 'User ID required' });
            }

            // Check if operator exists
            const operator = await prisma.user.findUnique({ 
                where: { id: operatorId }
            });

            if (!operator) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (operator.role === 'master' && operator.id === req.user.id) {
                return res.status(400).json({ message: 'Cannot delete yourself' });
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

            // Delete the operator/admin
            await prisma.user.delete({
                where: { id: operatorId }
            });

            res.json({ 
                message: `${operator.role === 'master' ? 'Admin' : 'Operator'} deleted successfully`,
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
                    role: true,
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

    async getPublicAdmins(req: Request, res: Response) {
        try {
            const admins = await prisma.user.findMany({
                where: { role: 'master' },
                select: { 
                    id: true, 
                    username: true,
                    role: true,
                    image: true
                },
                orderBy: { username: 'asc' },
            });

            res.json(admins);
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
                return res.status(403).json({ message: 'Only master can update users' });
            }

            const operatorId = parseInt(req.params.id);
            const { password, image, name, username } = req.body;

            console.log(`🔧 updateOperator called for id: ${operatorId}, body:`, req.body);

            if (!operatorId) {
                return res.status(400).json({ message: 'User ID required' });
            }

            // Check if operator exists
            const existingOperator = await prisma.user.findUnique({ 
                where: { id: operatorId }
            });

            if (!existingOperator) {
                return res.status(404).json({ message: 'User not found' });
            }

            const updateData: any = {};
            
            // Handle username change
            if (username !== undefined && username !== null) {
                const trimmedUsername = username.toString().trim();
                if (trimmedUsername && trimmedUsername !== existingOperator.username) {
                    // Check if new username already exists
                    const usernameExists = await prisma.user.findUnique({ 
                        where: { username: trimmedUsername } 
                    });
                    if (usernameExists) {
                        return res.status(400).json({ message: 'Username già in uso' });
                    }
                    updateData.username = trimmedUsername;
                }
            }
            
            if (password !== undefined && password !== null && password !== '') {
                updateData.passwordHash = await hashPassword(password);
            }
            
            if (image !== undefined) {
                updateData.image = image || null;
            }

            // TODO: name field disabled until Prisma client is properly regenerated with new schema
            // if (name !== undefined) {
            //     updateData.name = name || null;
            // }

            console.log(`📦 updateData:`, updateData);

            // If nothing to update, return current operator
            if (Object.keys(updateData).length === 0) {
                console.log(`⚠️  No changes to update`);
                return res.json({
                    message: 'No changes made',
                    operator: { id: existingOperator.id, username: existingOperator.username, name: existingOperator.name, image: existingOperator.image }
                });
            }

            const operator = await prisma.user.update({
                where: { id: operatorId },
                data: updateData
            });

            res.json({
                message: 'User updated successfully',
                operator: { id: operator.id, username: operator.username, name: operator.name, image: operator.image }
            });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            console.error('❌ Error updating operator:', errorMsg);
            res.status(500).json({ message: errorMsg });
        }
    }

    async seedDefaultUsers(req: Request, res: Response) {
        try {
            console.log('🌱 Seed endpoint called');
            
            // Controlla se ci sono già utenti
            const userCount = await prisma.user.count();
            if (userCount > 0) {
                return res.json({ message: 'Database already has users', userCount });
            }

            console.log('🔄 Creating default users...');

            // Hash delle password
            const adminHash = await hashPassword('123');
            const operatorHash = await hashPassword('operator123');

            // Crea admin Manuel
            const admin1 = await prisma.user.create({
                data: {
                    username: 'Manuel',
                    passwordHash: adminHash,
                    role: 'master',
                    image: null,
                },
            });

            // Crea admin Lucia
            const admin2 = await prisma.user.create({
                data: {
                    username: 'Admin Lucia',
                    passwordHash: adminHash,
                    role: 'master',
                    image: null,
                },
            });

            // Crea operatore Paolo
            const op1 = await prisma.user.create({
                data: {
                    username: 'Operatore Paolo',
                    passwordHash: operatorHash,
                    role: 'slave',
                    image: null,
                },
            });

            // Crea operatore Sara
            const op2 = await prisma.user.create({
                data: {
                    username: 'Operatore Sara',
                    passwordHash: operatorHash,
                    role: 'slave',
                    image: null,
                },
            });

            console.log('✅ Default users created:', [admin1.username, admin2.username, op1.username, op2.username]);

            res.json({
                message: 'Default users created successfully',
                users: [
                    { username: admin1.username, role: admin1.role },
                    { username: admin2.username, role: admin2.role },
                    { username: op1.username, role: op1.role },
                    { username: op2.username, role: op2.role },
                ],
            });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            console.error('❌ Seed error:', errorMsg);
            res.status(500).json({ message: errorMsg });
        }
    }
}