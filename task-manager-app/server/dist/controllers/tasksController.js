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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Priority to color mapping
const priorityColors = {
    'LOW': '#10B981', // green
    'MEDIUM': '#FCD34D', // yellow
    'HIGH': '#F97316', // orange
    'URGENT': '#EF4444' // red
};
class TasksController {
    getTasks(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user) {
                    return res.status(401).json({ message: 'Unauthorized' });
                }
                let tasks;
                if (req.user.role === 'master') {
                    // Master sees all tasks
                    tasks = yield prisma.task.findMany({
                        include: {
                            assignedOperator: { select: { id: true, username: true, role: true } },
                            createdBy: { select: { id: true, username: true } },
                            completedBy: { select: { id: true, username: true } },
                            notes: { include: { user: { select: { id: true, username: true } } } },
                        },
                        orderBy: [{ priority: 'desc' }, { scheduledAt: 'desc' }],
                    });
                }
                else {
                    // Slave sees only assigned tasks
                    tasks = yield prisma.task.findMany({
                        where: { assignedOperatorId: req.user.id },
                        include: {
                            assignedOperator: { select: { id: true, username: true, role: true } },
                            createdBy: { select: { id: true, username: true } },
                            completedBy: { select: { id: true, username: true } },
                            notes: { include: { user: { select: { id: true, username: true } } } },
                        },
                        orderBy: [{ priority: 'desc' }, { scheduledAt: 'desc' }],
                    });
                }
                res.json(tasks);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    createTask(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'master') {
                    return res.status(403).json({ message: 'Only master can create tasks' });
                }
                const { title, description, scheduledAt, assignedOperatorId, estimatedMinutes, priority } = req.body;
                if (!title) {
                    return res.status(400).json({ message: 'Title is required' });
                }
                const taskPriority = priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ? priority : 'MEDIUM';
                const taskColor = priorityColors[taskPriority];
                const newTask = yield prisma.task.create({
                    data: {
                        title,
                        description: description || null,
                        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                        assignedOperatorId: assignedOperatorId || null,
                        estimatedMinutes: estimatedMinutes || null,
                        priority: taskPriority,
                        color: taskColor,
                        createdById: req.user.id,
                    },
                    include: {
                        assignedOperator: { select: { id: true, username: true } },
                        createdBy: { select: { id: true, username: true } },
                    },
                });
                res.status(201).json(newTask);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    updateTask(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'master') {
                    return res.status(403).json({ message: 'Only master can update tasks' });
                }
                const { id } = req.params;
                const { title, description, scheduledAt, assignedOperatorId, estimatedMinutes, priority } = req.body;
                const updateData = {};
                if (title !== undefined)
                    updateData.title = title;
                if (description !== undefined)
                    updateData.description = description;
                if (scheduledAt !== undefined)
                    updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
                if (assignedOperatorId !== undefined)
                    updateData.assignedOperatorId = assignedOperatorId;
                if (estimatedMinutes !== undefined)
                    updateData.estimatedMinutes = estimatedMinutes;
                if (priority !== undefined && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
                    updateData.priority = priority;
                    updateData.color = priorityColors[priority];
                }
                const updatedTask = yield prisma.task.update({
                    where: { id: parseInt(id) },
                    data: updateData,
                    include: {
                        assignedOperator: { select: { id: true, username: true } },
                        createdBy: { select: { id: true, username: true } },
                    },
                });
                res.json(updatedTask);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    deleteTask(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'master') {
                    return res.status(403).json({ message: 'Only master can delete tasks' });
                }
                const { id } = req.params;
                yield prisma.task.delete({ where: { id: parseInt(id) } });
                res.status(204).send();
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    addNote(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user) {
                    return res.status(401).json({ message: 'Unauthorized' });
                }
                const { id } = req.params;
                const { note, actualMinutes, markCompleted } = req.body;
                // Verify task exists
                const task = yield prisma.task.findUnique({ where: { id: parseInt(id) } });
                if (!task) {
                    return res.status(404).json({ message: 'Task not found' });
                }
                // Add note
                const newNote = yield prisma.taskNote.create({
                    data: {
                        taskId: parseInt(id),
                        userId: req.user.id,
                        note: note || '',
                    },
                    include: {
                        user: { select: { id: true, username: true } },
                    },
                });
                // Mark completed if requested
                if (markCompleted) {
                    yield prisma.task.update({
                        where: { id: parseInt(id) },
                        data: {
                            completed: true,
                            completedById: req.user.id,
                            actualMinutes: actualMinutes || null,
                            completedAt: new Date(),
                        },
                    });
                }
                res.status(201).json(newNote);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    getNotes(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const notes = yield prisma.taskNote.findMany({
                    where: { taskId: parseInt(id) },
                    include: {
                        user: { select: { id: true, username: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                });
                res.json(notes);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    acceptTask(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'slave') {
                    return res.status(403).json({ message: 'Only operators can accept tasks' });
                }
                const { id } = req.params;
                // Check if operator already has an active task
                const activeTask = yield prisma.task.findFirst({
                    where: {
                        assignedOperatorId: req.user.id,
                        completed: false,
                        paused: false,
                        acceptedAt: { not: null },
                    },
                });
                if (activeTask) {
                    return res.status(400).json({
                        message: 'Operator already has an active task. Pause current task first.'
                    });
                }
                // Verify task exists and is assigned to this operator
                const task = yield prisma.task.findUnique({ where: { id: parseInt(id) } });
                if (!task) {
                    return res.status(404).json({ message: 'Task not found' });
                }
                if (task.assignedOperatorId !== req.user.id) {
                    return res.status(403).json({ message: 'Task not assigned to you' });
                }
                // Accept task
                const acceptedTask = yield prisma.task.update({
                    where: { id: parseInt(id) },
                    data: {
                        acceptedAt: new Date(),
                        acceptedById: req.user.id,
                        paused: false,
                        pausedAt: null,
                    },
                    include: {
                        assignedOperator: { select: { id: true, username: true } },
                        acceptedBy: { select: { id: true, username: true } },
                        createdBy: { select: { id: true, username: true } },
                        completedBy: { select: { id: true, username: true } },
                    },
                });
                res.json(acceptedTask);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    pauseTask(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'slave') {
                    return res.status(403).json({ message: 'Only operators can pause tasks' });
                }
                const { id } = req.params;
                // Verify task exists and is assigned to this operator
                const task = yield prisma.task.findUnique({ where: { id: parseInt(id) } });
                if (!task) {
                    return res.status(404).json({ message: 'Task not found' });
                }
                if (task.assignedOperatorId !== req.user.id) {
                    return res.status(403).json({ message: 'Task not assigned to you' });
                }
                // Pause task
                const pausedTask = yield prisma.task.update({
                    where: { id: parseInt(id) },
                    data: {
                        paused: true,
                        pausedAt: new Date(),
                    },
                    include: {
                        assignedOperator: { select: { id: true, username: true } },
                        acceptedBy: { select: { id: true, username: true } },
                        createdBy: { select: { id: true, username: true } },
                        completedBy: { select: { id: true, username: true } },
                    },
                });
                res.json(pausedTask);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    resumeTask(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'slave') {
                    return res.status(403).json({ message: 'Only operators can resume tasks' });
                }
                const { id } = req.params;
                // Verify task exists and is assigned to this operator
                const task = yield prisma.task.findUnique({ where: { id: parseInt(id) } });
                if (!task) {
                    return res.status(404).json({ message: 'Task not found' });
                }
                if (task.assignedOperatorId !== req.user.id) {
                    return res.status(403).json({ message: 'Task not assigned to you' });
                }
                // Resume task
                const resumedTask = yield prisma.task.update({
                    where: { id: parseInt(id) },
                    data: {
                        paused: false,
                        pausedAt: null,
                    },
                    include: {
                        assignedOperator: { select: { id: true, username: true } },
                        acceptedBy: { select: { id: true, username: true } },
                        createdBy: { select: { id: true, username: true } },
                        completedBy: { select: { id: true, username: true } },
                    },
                });
                res.json(resumedTask);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
}
exports.TasksController = TasksController;
