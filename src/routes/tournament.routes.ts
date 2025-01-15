import express from 'express';
import { TournamentController } from '../controllers/tournament.controller';
import { validateTournament } from '../middleware/validation.middleware';

const router = express.Router();
const tournamentController = new TournamentController();

// Player management routes   --> Moved to player.routes.ts TXY 2024.12.21 > No. back here
router.get('/players', tournamentController.getAllPlayers.bind(tournamentController));
router.post('/players', tournamentController.createPlayer.bind(tournamentController));
router.delete('/players/:id', tournamentController.deletePlayer.bind(tournamentController));
//Now your player routes will be accessible at:    //TXY  12.21 18:38
//GET /api/tournaments/players
//POST /api/tournaments/players
//DELETE /api/tournaments/players/:id



// Tournament routes
router.get('/', tournamentController.getTournaments.bind(tournamentController));
router.post('/', validateTournament, tournamentController.createTournament.bind(tournamentController));

// 临时路由：统一比赛格式
router.post('/normalize-formats', tournamentController.normalizeFormats.bind(tournamentController));

// Tournament detail routes
router.get('/:id', tournamentController.getTournamentById.bind(tournamentController));
router.put('/:id', validateTournament, tournamentController.updateTournament.bind(tournamentController));
router.post('/:id/players', tournamentController.addPlayer.bind(tournamentController));
router.post('/:id/rounds', tournamentController.generateNextRound.bind(tournamentController));
router.put('/:id/matches/:matchId/result', tournamentController.recordMatchResult.bind(tournamentController));
router.put('/:id/matches/:matchId', tournamentController.updateMatchResult.bind(tournamentController));
router.delete('/:id/rounds/:roundNumber', tournamentController.deleteRound.bind(tournamentController));
router.get('/:id/results', tournamentController.getTournamentResults.bind(tournamentController));
router.put('/:id/end', tournamentController.endTournament.bind(tournamentController));

export default router;
