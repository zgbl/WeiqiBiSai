import express from 'express';
import { TournamentController } from '../controllers/tournament.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateTournament } from '../middleware/validation.middleware';

const router = express.Router();
const tournamentController = new TournamentController();

// Player management routes   --> Moved to player.routes.ts TXY 2024.12.21 > No. back here
router.get('/players', tournamentController.getAllPlayers.bind(tournamentController));
router.post('/players', authenticate, tournamentController.createPlayer.bind(tournamentController));
router.delete('/players/:id', authenticate, tournamentController.deletePlayer.bind(tournamentController));
//Now your player routes will be accessible at:    //TXY  12.21 18:38
//GET /api/tournaments/players
//POST /api/tournaments/players
//DELETE /api/tournaments/players/:id



// Tournament routes
router.get('/', tournamentController.getTournaments.bind(tournamentController));
router.post('/', authenticate, validateTournament, tournamentController.createTournament.bind(tournamentController));

// 临时路由：统一比赛格式
router.post('/normalize-formats', tournamentController.normalizeFormats.bind(tournamentController));

// Tournament detail routes
router.get('/:id', tournamentController.getTournamentById.bind(tournamentController));
router.put('/:id', authenticate, validateTournament, tournamentController.updateTournament.bind(tournamentController));
router.post('/:id/players', authenticate, tournamentController.addPlayer.bind(tournamentController));
router.post('/:id/rounds', authenticate, tournamentController.generateNextRound.bind(tournamentController));
router.put('/:id/matches/:matchId', authenticate, tournamentController.updateMatchResult.bind(tournamentController));
router.delete('/:id/rounds/:roundNumber', authenticate, tournamentController.deleteRound.bind(tournamentController));
router.get('/:id/results', tournamentController.getTournamentResults.bind(tournamentController));

export default router;
