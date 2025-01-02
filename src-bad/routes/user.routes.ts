import express from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateUser, validateUserUpdate } from '../middleware/validation.middleware';

const router = express.Router();
const userController = new UserController();

// Public routes
router.post('/', validateUser, userController.createUser);

// Protected routes (require authentication)
router.get('/', authenticate, userController.getUsers);
router.get('/search', authenticate, userController.searchUsers);
router.get('/:id', authenticate, userController.getUserById);
router.put('/:id', authenticate, validateUserUpdate, userController.updateUser);
router.delete('/:id', authenticate, userController.deleteUser);

export default router;
