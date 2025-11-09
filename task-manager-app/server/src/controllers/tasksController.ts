import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Priority to color mapping
const priorityColors: { [key: string]: string } = {
    'LOW': '#10B981',      // green
    'MEDIUM': '#FCD34D',   // yellow
    'HIGH': '#F97316',     // orange
    'URGENT': '#EF4444'    // red
};

export class TasksController {
    async getTasks(req: Request, res: Response) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            let tasks;
            if (req.user.role === 'master') {
                // Master sees all tasks
                tasks = await prisma.task.findMany({
                    include: {
                        assignedOperator: { select: { id: true, username: true, role: true } },
                        createdBy: { select: { id: true, username: true } },
                        completedBy: { select: { id: true, username: true } },
                        notes: { include: { user: { select: { id: true, username: true } } } },
                    },
                    orderBy: [{ priority: 'desc' }, { scheduledAt: 'desc' }],
                });
            } else {
                // Slave sees only assigned tasks
                tasks = await prisma.task.findMany({
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
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async createTask(req: Request, res: Response) {
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

            const newTask = await prisma.task.create({
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
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async updateTask(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'master') {
                return res.status(403).json({ message: 'Only master can update tasks' });
            }

            const { id } = req.params;
            const { title, description, scheduledAt, assignedOperatorId, estimatedMinutes, priority } = req.body;

            const updateData: any = {};
            
            if (title !== undefined) updateData.title = title;
            if (description !== undefined) updateData.description = description;
            if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
            if (assignedOperatorId !== undefined) updateData.assignedOperatorId = assignedOperatorId;
            if (estimatedMinutes !== undefined) updateData.estimatedMinutes = estimatedMinutes;
            
            if (priority !== undefined && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
                updateData.priority = priority;
                updateData.color = priorityColors[priority];
            }

            const updatedTask = await prisma.task.update({
                where: { id: parseInt(id) },
                data: updateData,
                include: {
                    assignedOperator: { select: { id: true, username: true } },
                    createdBy: { select: { id: true, username: true } },
                },
            });

            res.json(updatedTask);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async deleteTask(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'master') {
                return res.status(403).json({ message: 'Only master can delete tasks' });
            }

            const { id } = req.params;
            await prisma.task.delete({ where: { id: parseInt(id) } });

            res.status(204).send();
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async addNote(req: Request, res: Response) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { id } = req.params;
            const { note, actualMinutes, markCompleted } = req.body;

            // Verify task exists
            const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
            if (!task) {
                return res.status(404).json({ message: 'Task not found' });
            }

            // Add note
            const newNote = await prisma.taskNote.create({
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
                await prisma.task.update({
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
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async getNotes(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const notes = await prisma.taskNote.findMany({
                where: { taskId: parseInt(id) },
                include: {
                    user: { select: { id: true, username: true } },
                },
                orderBy: { createdAt: 'desc' },
            });

            res.json(notes);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async acceptTask(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'slave') {
                return res.status(403).json({ message: 'Only operators can accept tasks' });
            }

            const { id } = req.params;

            // Check if operator already has an active task
            const activeTask = await prisma.task.findFirst({
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
            const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
            if (!task) {
                return res.status(404).json({ message: 'Task not found' });
            }

            if (task.assignedOperatorId !== req.user.id) {
                return res.status(403).json({ message: 'Task not assigned to you' });
            }

            // Accept task
            const acceptedTask = await prisma.task.update({
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
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async pauseTask(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'slave') {
                return res.status(403).json({ message: 'Only operators can pause tasks' });
            }

            const { id } = req.params;

            // Verify task exists and is assigned to this operator
            const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
            if (!task) {
                return res.status(404).json({ message: 'Task not found' });
            }

            if (task.assignedOperatorId !== req.user.id) {
                return res.status(403).json({ message: 'Task not assigned to you' });
            }

            // Pause task
            const pausedTask = await prisma.task.update({
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
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }

    async resumeTask(req: Request, res: Response) {
        try {
            if (!req.user || req.user.role !== 'slave') {
                return res.status(403).json({ message: 'Only operators can resume tasks' });
            }

            const { id } = req.params;

            // Verify task exists and is assigned to this operator
            const task = await prisma.task.findUnique({ where: { id: parseInt(id) } });
            if (!task) {
                return res.status(404).json({ message: 'Task not found' });
            }

            if (task.assignedOperatorId !== req.user.id) {
                return res.status(403).json({ message: 'Task not assigned to you' });
            }

            // Resume task
            const resumedTask = await prisma.task.update({
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
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Internal server error';
            res.status(500).json({ message: errorMsg });
        }
    }
}
