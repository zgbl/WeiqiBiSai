import express from 'express';
import { TournamentController } from '../controllers/tournament.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();
const controller = new TournamentController();

// Player management routes
router.get('/', (req, res) => controller.getAllPlayers(req, res));
router.post('/', authenticate, (req, res) => controller.createPlayer(req, res));
router.get('/:playerId', (req, res) => controller.getPlayerById(req, res));
router.put('/:playerId', authenticate, (req, res) => controller.updatePlayer(req, res));
router.delete('/:playerId', authenticate, (req, res) => controller.deletePlayer(req, res));

export default router;
