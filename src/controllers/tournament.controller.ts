import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { TournamentService } from '../services/tournament.service';
import { TournamentFormat, TournamentStatus } from '../types/tournament.types';
import Tournament from '../models/tournament.model';
import Player from '../models/player.model';
import { MongoId, toObjectId } from '../types/mongoose.types';

const tournamentService = new TournamentService();

export class TournamentController {
  // Create a new tournament
  async createTournament(req: Request, res: Response) {
    try {
      const { name, format, startDate, endDate, description } = req.body;
      
      // Validate required fields
      if (!name || !format || !startDate || !endDate) {
        return res.status(400).json({ 
          message: 'Missing required fields: name, format, startDate, endDate' 
        });
      }

      // Create tournament
      const tournament = await tournamentService.createTournament({
        name,
        format: format as TournamentFormat,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        description,
        status: TournamentStatus.UPCOMING,
        players: [],
        rounds: []
      });

      res.status(201).json(tournament);
    } catch (error: any) {
      console.error('Error creating tournament:', error);
      res.status(400).json({ message: error.message });
    }
  }

  // Get all tournaments
  async getTournaments(req: Request, res: Response) {
    try {
      const tournaments = await tournamentService.getAllTournaments();
      res.json(tournaments);
    } catch (error: any) {
      console.error('Error fetching tournaments:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Get tournament by ID
  async getTournamentById(req: Request, res: Response) {
    try {
      const tournament = await tournamentService.getTournamentById(req.params.id);
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }
      res.json(tournament);
    } catch (error: any) {
      console.error('Error fetching tournament:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Add player to tournament
  async addPlayer(req: Request, res: Response) {
    try {
      const { tournamentId, playerId } = req.params;
      const tournament = await tournamentService.getTournamentById(tournamentId);
      const player = await tournamentService.getPlayerById(playerId);

      if (!tournament || !player) {
        return res.status(404).json({ message: 'Tournament or player not found' });
      }

      tournament.players.push(toObjectId(player._id));
      if (player.tournaments) {
        player.tournaments.push(toObjectId(tournament._id));
      }

      await tournament.save();
      await player.save();

      res.json(tournament);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'An unknown error occurred' });
      }
    }
  }

  // Generate next round
  async generateNextRound(req: Request, res: Response) {
    try {
      const { tournamentId } = req.params;  
      console.log('Generating next round for tournament:', tournamentId);

      const tournament = await Tournament.findById(tournamentId)
        .populate('players', 'name rank')
        .populate({
          path: 'rounds.matches.winner',
          select: 'name rank'
        })
        .exec();

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // If tournament is UPCOMING, generate all rounds
      if (tournament.status === TournamentStatus.UPCOMING) {
        console.log('Tournament is upcoming, generating all rounds...');
        const updatedTournament = await tournamentService.generatePairings(tournamentId);
        console.log('Generated all rounds:', updatedTournament.rounds);
        res.json(updatedTournament);
        return;
      }

      // For ONGOING tournaments, check if current round is complete
      const currentRound = tournament.rounds[tournament.rounds.length - 1];
      if (!currentRound.completed) {
        throw new Error('Current round is not complete');
      }

      // For round-robin format, just mark the next round as active
      if (tournament.format === TournamentFormat.ROUNDROBIN) {
        const nextRoundIndex = tournament.rounds.findIndex(r => !r.completed);
        if (nextRoundIndex === -1) {
          throw new Error('All rounds are completed');
        }

        // Return the tournament with all rounds
        const updatedTournament = await Tournament.findById(tournamentId)
          .populate('players', 'name rank')
          .populate({
            path: 'rounds.matches.player1',
            select: 'name rank'
          })
          .populate({
            path: 'rounds.matches.player2',
            select: 'name rank'
          })
          .populate({
            path: 'rounds.matches.winner',
            select: 'name rank'
          })
          .lean()
          .exec();

        res.json(updatedTournament);
        return;
      }

      throw new Error('Unsupported tournament format');
    } catch (error: any) {
      console.error('Error generating next round:', error);
      res.status(400).json({ message: error.message });
    }
  }

  // Update match results
  async updateMatchResults(req: Request, res: Response) {
    try {
      const tournamentId = req.params.id;  
      const { matchResults } = req.body;

      const updatedTournament = await tournamentService.updateTournamentResults(
        tournamentId,
        matchResults
      );

      res.json(updatedTournament);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  // Record match result
  async recordMatchResult(req: Request, res: Response) {
    try {
      console.log('Request params:', req.params);
      console.log('Request body:', req.body);
      
      const { id, matchId } = req.params;  
      const { winnerId } = req.body;

      console.log('Extracted values:', { id, matchId, winnerId });

      if (!winnerId) {
        return res.status(400).json({ message: 'Winner ID is required' });
      }

      const tournament = await tournamentService.recordMatchResult(
        id,
        matchId,
        winnerId
      );

      res.json(tournament);
    } catch (error: any) {
      console.error('Error recording match result:', error);
      res.status(400).json({ message: error.message });
    }
  }

  // Delete round
  async deleteRound(req: Request, res: Response) {
    try {
      const { id, roundNumber } = req.params;  
      
      const tournament = await Tournament.findById(id);
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

      // Convert roundNumber to number
      const roundNum = parseInt(roundNumber);
      if (isNaN(roundNum)) {
        return res.status(400).json({ message: 'Invalid round number' });
      }

      // Remove the specified round and all subsequent rounds
      tournament.rounds = tournament.rounds.filter(r => r.roundNumber < roundNum);

      // Update tournament status if necessary
      if (tournament.rounds.length === 0) {
        tournament.status = TournamentStatus.UPCOMING;
      } else if (tournament.status === TournamentStatus.COMPLETED) {
        tournament.status = TournamentStatus.ONGOING;
      }

      await tournament.save();

      // Return updated tournament with populated data
      const updatedTournament = await Tournament.findById(id)
        .populate('players', 'name rank')
        .populate({
          path: 'rounds.matches.player1',
          select: 'name rank'
        })
        .populate({
          path: 'rounds.matches.player2',
          select: 'name rank'
        })
        .populate({
          path: 'rounds.matches.winner',
          select: 'name rank'
        })
        .lean()
        .exec();

      res.json(updatedTournament);
    } catch (error: any) {
      console.error('Error deleting round:', error);
      res.status(400).json({ message: error.message });
    }
  }

  // Update tournament
  async updateTournament(req: Request, res: Response) {
    try {
      const id = req.params.id;  
      const { name, format, startDate, endDate, description } = req.body;

      // Validate required fields
      if (!name || !format || !startDate || !endDate) {
        return res.status(400).json({ 
          message: 'Missing required fields: name, format, startDate, endDate' 
        });
      }

      const tournament = await Tournament.findById(id);
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

      // Only allow updates if tournament hasn't started
      if (tournament.status !== TournamentStatus.UPCOMING) {
        return res.status(400).json({ 
          message: 'Cannot update tournament after it has started' 
        });
      }

      const updatedTournament = await Tournament.findByIdAndUpdate(
        id,
        {
          name,
          format,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          description
        },
        { new: true }
      );

      res.json(updatedTournament);
    } catch (error: any) {
      console.error('Error updating tournament:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Get all players
  async getAllPlayers(req: Request, res: Response) {
    try {
      console.log('Fetching all players...');
      const players = await Player.find()
        .select('name rank rating wins losses draws')
        .lean()
        .exec();
      console.log('Found players:', players);
      res.json(players);
    } catch (error: any) {
      console.error('Error fetching players:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Create a new player
  async createPlayer(req: Request, res: Response) {
    try {
      const { name, rank } = req.body;
      
      // Validate required fields
      if (!name || !rank) {
        return res.status(400).json({ 
          message: 'Missing required fields: name, rank' 
        });
      }

      // Check if player already exists
      const existingPlayer = await Player.findOne({ name });
      if (existingPlayer) {
        return res.status(400).json({ message: 'Player already exists' });
      }

      // Create new player
      const player = await Player.create({
        name,
        rank,
        wins: 0,
        losses: 0,
        draws: 0
      });

      res.status(201).json(player);
    } catch (error: any) {
      console.error('Error creating player:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Delete a player
  async deletePlayer(req: Request, res: Response) {
    try {
      const id = req.params.id;  
      
      // Check if player exists
      const player = await Player.findById(id);
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }

      // Check if player is in any tournaments
      const tournaments = await Tournament.find({ players: id });
      if (tournaments.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete player who is in tournaments' 
        });
      }

      await Player.findByIdAndDelete(id);
      res.json({ message: 'Player deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting player:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Generate rounds
  async generateRounds(req: Request, res: Response) {
    try {
      const { tournamentId } = req.params;
      const updatedTournament = await tournamentService.generatePairings(tournamentId);
      
      if (updatedTournament) {
        console.log('Generated all rounds:', updatedTournament.rounds);
        res.json(updatedTournament);
      } else {
        res.status(404).json({ message: 'Tournament not found' });
      }
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'An unknown error occurred' });
      }
    }
  }
}
