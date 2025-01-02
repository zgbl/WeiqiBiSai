import express from 'express';
import { TournamentController } from '../controllers/tournament.controller';
import { validateTournament } from '../middleware/validation.middleware';
import { body } from 'express-validator';
import { TournamentFormat } from '../types/tournament.types';

const router = express.Router();
const controller = new TournamentController();

// Validation rules for tournament data
const tournamentValidation = [
  body('name').notEmpty().withMessage('Tournament name is required'),
  body('format')
    .isIn(Object.values(TournamentFormat))
    .withMessage('Invalid tournament format'),
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('description').optional(),
  body('groups').optional().isArray(),
  validateTournament
];

// Tournament routes
router.get('/', (req, res) => controller.getTournaments(req, res));
router.post('/', tournamentValidation, (req, res) => controller.createTournament(req, res));
router.get('/:id', (req, res) => controller.getTournamentById(req, res));
router.put('/:id', tournamentValidation, (req, res) => controller.updateTournament(req, res));
router.delete('/:id', (req, res) => controller.deleteTournament(req, res));

// Tournament player management
router.post('/:id/players', (req, res) => controller.addPlayer(req, res));
router.delete('/:id/players/:playerId', (req, res) => controller.removePlayer(req, res));

// Tournament management routes
router.post('/:id/start', (req, res) => controller.startTournament(req, res));

// Tournament rounds and matches
router.post('/:id/rounds', (req, res) => controller.generateNextRound(req, res));
router.put('/:id/rounds/:roundNumber/matches/:matchId', (req, res) => controller.updateMatchResult(req, res));
router.delete('/:id/rounds/:roundNumber', (req, res) => controller.deleteRound(req, res));

export default router;
