import express from 'express';
import { TournamentController } from '../controllers/tournament.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateTournament } from '../middleware/validation.middleware';

const router = express.Router();
const tournamentController = new TournamentController();

// Player management routes   --> Moved to player.routes.ts TXY 2024.12.21 > No. back here
router.get('/players', tournamentController.getAllPlayers);
router.post('/players', authenticate, tournamentController.createPlayer);
router.delete('/players/:id', authenticate, tournamentController.deletePlayer);
//Now your player routes will be accessible at:    //TXY  12.21 18:38
//GET /api/tournaments/players
//POST /api/tournaments/players
//DELETE /api/tournaments/players/:id



// Tournament routes
router.get('/', tournamentController.getTournaments);
router.post('/', authenticate, validateTournament, tournamentController.createTournament);

// Tournament detail routes
router.get('/:id', tournamentController.getTournamentById);
router.put('/:id', authenticate, validateTournament, tournamentController.updateTournament);
router.post('/:id/players', authenticate, tournamentController.addPlayer);
router.post('/:id/rounds', authenticate, tournamentController.generateNextRound);
router.put('/:id/matches/:matchId', authenticate, tournamentController.updateMatchResult);
router.delete('/:id/rounds/:roundNumber', authenticate, tournamentController.deleteRound);
router.get('/:id/results', tournamentController.getTournamentResults);

export default router;
