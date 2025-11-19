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
                const { title, description, scheduledAt, assignedOperatorId, estimatedMinutes, priority, recurrenceType, recurrenceEnd } = req.body;
                if (!title) {
                    return res.status(400).json({ message: 'Title is required' });
                }
                const taskPriority = priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ? priority : 'MEDIUM';
                const taskColor = priorityColors[taskPriority];
                // Se non c'è ricorrenza, crea un task singolo
                if (!recurrenceType) {
                    const newTask = yield prisma.task.create({
                        data: {
                            title,
                            description: description || null,
                            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                            originalScheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                            assignedOperatorId: assignedOperatorId || null,
                            estimatedMinutes: estimatedMinutes || null,
                            priority: taskPriority,
                            color: taskColor,
                            recurring: false,
                            recurrenceType: null,
                            recurrenceEnd: null,
                            createdById: req.user.id,
                        },
                        include: {
                            assignedOperator: { select: { id: true, username: true } },
                            createdBy: { select: { id: true, username: true } },
                        },
                    });
                    res.status(201).json(newTask);
                    return;
                }
                // Se c'è ricorrenza, crea il task parent e le istanze ricorrenti
                if (!scheduledAt) {
                    return res.status(400).json({ message: 'Data/ora richiesta per task ricorrenti' });
                }
                const startDate = new Date(scheduledAt);
                const endDate = recurrenceEnd ? new Date(recurrenceEnd) : new Date(startDate.getTime() + 12 * 30 * 24 * 60 * 60 * 1000); // 12 mesi di default
                // Genera le date per le istanze ricorrenti
                const instanceDates = [];
                let currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    instanceDates.push(new Date(currentDate));
                    switch (recurrenceType) {
                        case 'DAILY':
                            currentDate.setDate(currentDate.getDate() + 1);
                            break;
                        case 'WEEKLY':
                            currentDate.setDate(currentDate.getDate() + 7);
                            break;
                        case 'BIWEEKLY':
                            currentDate.setDate(currentDate.getDate() + 14);
                            break;
                        case 'MONTHLY':
                            currentDate.setMonth(currentDate.getMonth() + 1);
                            break;
                        case 'QUARTERLY':
                            currentDate.setMonth(currentDate.getMonth() + 3);
                            break;
                        case 'YEARLY':
                            currentDate.setFullYear(currentDate.getFullYear() + 1);
                            break;
                    }
                }
                // Crea le istanze ricorrenti
                const createdTasks = [];
                for (const instanceDate of instanceDates) {
                    const task = yield prisma.task.create({
                        data: {
                            title,
                            description: description || null,
                            scheduledAt: new Date(instanceDate),
                            originalScheduledAt: new Date(instanceDate),
                            assignedOperatorId: assignedOperatorId || null,
                            estimatedMinutes: estimatedMinutes || null,
                            priority: taskPriority,
                            color: taskColor,
                            recurring: true,
                            recurrenceType,
                            recurrenceEnd: endDate,
                            createdById: req.user.id,
                        },
                        include: {
                            assignedOperator: { select: { id: true, username: true } },
                            createdBy: { select: { id: true, username: true } },
                        },
                    });
                    createdTasks.push(task);
                }
                res.status(201).json({
                    message: `Creati ${createdTasks.length} task ricorrenti`,
                    tasks: createdTasks
                });
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
                console.log(`DEBUG updateTask: Raw req.body:`, req.body);
                const { title, description, scheduledAt, assignedOperatorId, estimatedMinutes, priority, recurrenceType, recurrenceEnd, acceptedAt, paused, completed } = req.body;
                console.log(`DEBUG updateTask: Updating task ${id} with data:`, { title, description, scheduledAt, assignedOperatorId, estimatedMinutes, priority, recurrenceType, recurrenceEnd, acceptedAt, paused, completed });
                const updateData = {};
                if (title !== undefined)
                    updateData.title = title;
                if (description !== undefined)
                    updateData.description = description;
                if (scheduledAt !== undefined) {
                    updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
                    // Se scheduledAt viene impostato e originalScheduledAt non esiste, lo impostiamo
                    const task = yield prisma.task.findUnique({ where: { id: parseInt(id) } });
                    if (task && !task.originalScheduledAt && scheduledAt) {
                        updateData.originalScheduledAt = new Date(scheduledAt);
                    }
                }
                if (assignedOperatorId !== undefined)
                    updateData.assignedOperatorId = assignedOperatorId;
                if (estimatedMinutes !== undefined)
                    updateData.estimatedMinutes = estimatedMinutes;
                if (recurrenceType !== undefined) {
                    console.log(`DEBUG: Setting recurrenceType to "${recurrenceType}"`);
                    updateData.recurrenceType = recurrenceType;
                }
                if (recurrenceEnd !== undefined)
                    updateData.recurrenceEnd = recurrenceEnd ? new Date(recurrenceEnd) : null;
                if (acceptedAt !== undefined) {
                    updateData.acceptedAt = acceptedAt ? new Date(acceptedAt) : null;
                    if (acceptedAt)
                        updateData.acceptedById = req.user.id;
                }
                if (paused !== undefined) {
                    updateData.paused = paused;
                    if (paused) {
                        updateData.pausedAt = new Date();
                    }
                    else {
                        updateData.pausedAt = null;
                    }
                }
                if (completed !== undefined) {
                    updateData.completed = completed;
                    if (completed) {
                        updateData.completedAt = new Date();
                        updateData.completedById = req.user.id;
                    }
                    else {
                        updateData.completedAt = null;
                        updateData.completedById = null;
                    }
                }
                if (priority !== undefined && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
                    updateData.priority = priority;
                    updateData.color = priorityColors[priority];
                }
                console.log(`DEBUG: updateData to be saved:`, updateData);
                const updatedTask = yield prisma.task.update({
                    where: { id: parseInt(id) },
                    data: updateData,
                    include: {
                        assignedOperator: { select: { id: true, username: true } },
                        createdBy: { select: { id: true, username: true } },
                    },
                });
                console.log(`DEBUG: Task updated successfully. New recurrenceType:`, updatedTask.recurrenceType);
                res.json(updatedTask);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                console.error(`DEBUG: Error updating task:`, errorMsg);
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
                    // If operator marks task complete, it goes back to admin task (unassigned)
                    if (req.user.role === 'slave') {
                        yield prisma.task.update({
                            where: { id: parseInt(id) },
                            data: {
                                completed: true,
                                completedById: req.user.id,
                                actualMinutes: actualMinutes || null,
                                completedAt: new Date(),
                                assignedOperatorId: null, // Unassign from operator
                                acceptedAt: null,
                                acceptedById: null,
                                paused: false,
                                pausedAt: null,
                            },
                        });
                    }
                    else {
                        // Master can mark tasks directly as completed
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
    postponeTask(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'slave') {
                    return res.status(403).json({ message: 'Only operators can postpone tasks' });
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
                // Only postpone if task has a scheduled date
                if (!task.scheduledAt) {
                    return res.status(400).json({ message: 'Task has no scheduled date' });
                }
                // Function to check if date is a weekend (only Sunday)
                const isWeekend = (date) => {
                    const day = date.getDay();
                    return day === 0; // 0 = Sunday only
                };
                // Italian holidays 2024-2025 (Add more years as needed)
                const italianHolidays = [
                    '2024-01-01', // Capodanno
                    '2024-01-06', // Epifania
                    '2024-04-25', // Festa della Liberazione
                    '2024-05-01', // Festa del Lavoro
                    '2024-06-02', // Festa della Repubblica
                    '2024-08-15', // Ferragosto
                    '2024-11-01', // Ognissanti
                    '2024-12-08', // Immacolata Concezione
                    '2024-12-25', // Natale
                    '2024-12-26', // Santo Stefano
                    '2025-01-01', // Capodanno
                    '2025-01-06', // Epifania
                    '2025-04-25', // Festa della Liberazione
                    '2025-05-01', // Festa del Lavoro
                    '2025-06-02', // Festa della Repubblica
                    '2025-08-15', // Ferragosto
                    '2025-11-01', // Ognissanti
                    '2025-12-08', // Immacolata Concezione
                    '2025-12-25', // Natale
                    '2025-12-26', // Santo Stefano
                    '2026-01-01', // Capodanno
                    '2026-01-06', // Epifania
                    '2026-04-25', // Festa della Liberazione
                    '2026-05-01', // Festa del Lavoro
                    '2026-06-02', // Festa della Repubblica
                    '2026-08-15', // Ferragosto
                    '2026-11-01', // Ognissanti
                    '2026-12-08', // Immacolata Concezione
                    '2026-12-25', // Natale
                    '2026-12-26', // Santo Stefano
                ];
                const isHoliday = (date) => {
                    const dateStr = date.toISOString().split('T')[0];
                    return italianHolidays.includes(dateStr);
                };
                // Calculate next working day (skip weekends and holidays)
                let newDate = new Date(task.scheduledAt);
                newDate.setDate(newDate.getDate() + 1);
                while (isWeekend(newDate) || isHoliday(newDate)) {
                    newDate.setDate(newDate.getDate() + 1);
                }
                // Postpone task
                const postponedTask = yield prisma.task.update({
                    where: { id: parseInt(id) },
                    data: {
                        scheduledAt: newDate,
                        // Keep originalScheduledAt unchanged
                    },
                    include: {
                        assignedOperator: { select: { id: true, username: true } },
                        acceptedBy: { select: { id: true, username: true } },
                        createdBy: { select: { id: true, username: true } },
                        completedBy: { select: { id: true, username: true } },
                    },
                });
                res.json(postponedTask);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
    resetTaskToSuspended(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.user || req.user.role !== 'master') {
                    return res.status(403).json({ message: 'Only master can reset tasks' });
                }
                const { id } = req.params;
                // Verify task exists
                const task = yield prisma.task.findUnique({ where: { id: parseInt(id) } });
                if (!task) {
                    return res.status(404).json({ message: 'Task not found' });
                }
                // Reset task to suspended state (only remove acceptance and completion)
                const resetTask = yield prisma.task.update({
                    where: { id: parseInt(id) },
                    data: {
                        acceptedAt: null,
                        acceptedById: null,
                        completed: false,
                        completedAt: null,
                        completedById: null,
                        actualMinutes: null,
                        paused: false,
                        pausedAt: null,
                    },
                    include: {
                        assignedOperator: { select: { id: true, username: true } },
                        createdBy: { select: { id: true, username: true } },
                        completedBy: { select: { id: true, username: true } },
                    },
                });
                res.json(resetTask);
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Internal server error';
                res.status(500).json({ message: errorMsg });
            }
        });
    }
}
exports.TasksController = TasksController;
