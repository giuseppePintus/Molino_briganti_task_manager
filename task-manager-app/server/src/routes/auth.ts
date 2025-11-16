import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware, requireMaster } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

router.post('/login', (req, res) => authController.login(req, res));
router.post('/quick-login', (req, res) => authController.quickLogin(req, res));
router.get('/operators/public', (req, res) => authController.getPublicOperators(req, res));
router.get('/admins/public', (req, res) => authController.getPublicAdmins(req, res));
router.get('/operators', authMiddleware, requireMaster, (req, res) => authController.getOperators(req, res));
router.get('/admins', authMiddleware, requireMaster, (req, res) => authController.getAdmins(req, res));
router.get('/users-for-assignment', authMiddleware, requireMaster, (req, res) => authController.getAllUsersForAssignment(req, res));
router.post('/create-operator', authMiddleware, requireMaster, (req, res) => authController.createOperator(req, res));
router.post('/create-admin', authMiddleware, requireMaster, (req, res) => authController.createAdmin(req, res));
router.put('/operators/:id', authMiddleware, requireMaster, (req, res) => authController.updateOperator(req, res));
router.put('/operators/:id/image', authMiddleware, requireMaster, (req, res) => authController.updateOperatorImage(req, res));
router.delete('/operators/:id', authMiddleware, requireMaster, (req, res) => authController.deleteOperator(req, res));

export default router;