"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const User_1 = require("../models/User");
const prisma = new client_1.PrismaClient();
class AuthController {
    login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { username, password } = req.body;
                if (!username || !password) {
                    return res.status(400).json({ message: 'Username and password required' });
                }
                const user = yield prisma.user.findUnique({ where: { username } });
                if (!user) {
                    return res.status(401).json({ message: 'Invalid credentials' });
                }
                const isPasswordValid = yield (0, User_1.comparePassword)(password, user.passwordHash);
                if (!isPasswordValid) {
                    return res.status(401).json({ message: 'Invalid credentials' });
                }
                const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
                res.json({
                    message: 'Login successful',
                    token,
                    user: { id: user.id, username: user.username, role: user.role },
                });
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    getOperators(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'master') {
                    return res.status(403).json({ message: 'Only master can list operators' });
                }
                const operators = yield prisma.user.findMany({
                    where: { role: 'slave' },
                    select: { id: true, username: true, role: true, createdAt: true },
                    orderBy: { username: 'asc' },
                });
                res.json(operators);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    createOperator(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'master') {
                    return res.status(403).json({ message: 'Only master can create operators' });
                }
                const { username, password } = req.body;
                if (!username || !password) {
                    return res.status(400).json({ message: 'Username and password required' });
                }
                // Check if user already exists
                const existingUser = yield prisma.user.findUnique({ where: { username } });
                if (existingUser) {
                    return res.status(400).json({ message: 'Username already exists' });
                }
                const passwordHash = yield (0, User_1.hashPassword)(password);
                const user = yield prisma.user.create({
                    data: {
                        username,
                        passwordHash,
                        role: 'slave',
                    },
                });
                res.status(201).json({
                    message: 'Operator created successfully',
                    user: { id: user.id, username: user.username, role: user.role }
                });
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    deleteOperator(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'master') {
                    return res.status(403).json({ message: 'Only master can delete operators' });
                }
                const operatorId = parseInt(req.params.id);
                if (!operatorId) {
                    return res.status(400).json({ message: 'Operator ID required' });
                }
                // Check if operator exists
                const operator = yield prisma.user.findUnique({
                    where: { id: operatorId }
                });
                if (!operator) {
                    return res.status(404).json({ message: 'Operator not found' });
                }
                if (operator.role !== 'slave') {
                    return res.status(400).json({ message: 'Only slave users can be deleted' });
                }
                // First, unassign any tasks assigned to this operator
                yield prisma.task.updateMany({
                    where: { assignedOperatorId: operatorId },
                    data: { assignedOperatorId: null }
                });
                // Delete any notes created by this operator
                yield prisma.taskNote.deleteMany({
                    where: { userId: operatorId }
                });
                // Delete the operator
                yield prisma.user.delete({
                    where: { id: operatorId }
                });
                res.json({
                    message: 'Operator deleted successfully',
                    username: operator.username
                });
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    getPublicOperators(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const operators = yield prisma.user.findMany({
                    where: { role: 'slave' },
                    select: {
                        id: true,
                        username: true,
                        image: true
                    },
                    orderBy: { username: 'asc' },
                });
                res.json(operators);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    quickLogin(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { operatorId } = req.body;
                if (!operatorId) {
                    return res.status(400).json({ message: 'Operator ID required' });
                }
                const operator = yield prisma.user.findUnique({
                    where: { id: parseInt(operatorId) }
                });
                if (!operator) {
                    return res.status(404).json({ message: 'Operator not found' });
                }
                if (operator.role !== 'slave') {
                    return res.status(403).json({ message: 'Invalid operator' });
                }
                const token = jsonwebtoken_1.default.sign({ id: operator.id, username: operator.username, role: operator.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
                res.json({
                    message: 'Login successful',
                    token,
                    user: { id: operator.id, username: operator.username, role: operator.role },
                });
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    updateOperatorImage(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'master') {
                    return res.status(403).json({ message: 'Only master can update operator images' });
                }
                const { operatorId, image } = req.body;
                if (!operatorId || !image) {
                    return res.status(400).json({ message: 'Operator ID and image required' });
                }
                const operator = yield prisma.user.update({
                    where: { id: parseInt(operatorId) },
                    data: { image }
                });
                res.json({
                    message: 'Operator image updated successfully',
                    operator: { id: operator.id, username: operator.username, image: operator.image }
                });
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
}
exports.AuthController = AuthController;
