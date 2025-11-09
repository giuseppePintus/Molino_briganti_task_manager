import { Router } from 'express';
import { TasksController } from '../controllers/tasksController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const tasksController = new TasksController();

// All routes require authentication
router.use(authMiddleware);

// Task routes
router.get('/', (req, res) => tasksController.getTasks(req, res));
router.post('/', (req, res) => tasksController.createTask(req, res));
router.put('/:id', (req, res) => tasksController.updateTask(req, res));
router.delete('/:id', (req, res) => tasksController.deleteTask(req, res));

// Task acceptance workflow
router.post('/:id/accept', (req, res) => tasksController.acceptTask(req, res));
router.post('/:id/pause', (req, res) => tasksController.pauseTask(req, res));
router.post('/:id/resume', (req, res) => tasksController.resumeTask(req, res));

// Task notes routes
router.post('/:id/notes', (req, res) => tasksController.addNote(req, res));
router.get('/:id/notes', (req, res) => tasksController.getNotes(req, res));

export default router;