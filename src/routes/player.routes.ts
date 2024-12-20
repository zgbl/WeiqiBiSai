import express from 'express';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Placeholder routes - to be implemented
router.get('/', authenticate, (req, res) => {
  res.json({ message: 'Player routes to be implemented' });
});

export default router;
