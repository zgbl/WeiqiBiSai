import express from 'express';
import { TournamentController } from '../controllers/tournament.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Player management routes  //back to rounament.routes.ts
//router.get('/players', TournamentController.getAllPlayers);
//router.post('/players', authenticate, TournamentController.createPlayer);
//router.delete('/players/:id', authenticate, TournamentController.deletePlayer);

// This file is deprecated as player routes have been moved to tournament.routes.ts
console.warn('player.routes.ts is deprecated. Use tournament.routes.ts instead.');

export default router;

