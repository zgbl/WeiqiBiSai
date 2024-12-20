import express from 'express';
import { TournamentController } from '../controllers/tournament.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateTournament } from '../middleware/validation.middleware';

const router = express.Router();
const tournamentController = new TournamentController();

// Public routes
router.get('/', tournamentController.getTournaments);

// Player routes - 放在具体 ID 路由之前
router.get('/players', tournamentController.getAllPlayers);
router.post('/players', tournamentController.createPlayer);
router.delete('/players/:id', tournamentController.deletePlayer);

// Tournament specific routes
router.get('/:id', tournamentController.getTournamentById);
router.post('/', validateTournament, tournamentController.createTournament);
router.put('/:id', validateTournament, tournamentController.updateTournament);
router.post('/:id/players', tournamentController.addPlayer);
router.post('/:id/rounds', tournamentController.generateNextRound);

// Tournament matches routes
router.put('/:id/matches/:matchId', tournamentController.recordMatchResult);
router.delete('/:id/rounds/:roundNumber', tournamentController.deleteRound);

export default router;
