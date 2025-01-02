import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { TournamentService } from '../services/tournament.service';
import { TournamentFormat, TournamentStatus } from '../types/tournament.types';
import Tournament from '../models/tournament.model';
import Player from '../models/player.model';
import { toObjectId } from '../types/mongoose.types';

export class TournamentController {
  private tournamentService: TournamentService;

  constructor() {
    this.tournamentService = new TournamentService();
  }

  // Create a new tournament
  async createTournament(req: Request, res: Response) {
    try {
      console.log('Request body:', req.body);

      // 验证必需字段
      const requiredFields = ['name', 'format', 'startDate', 'endDate'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({
          errors: [`Missing required fields: ${missingFields.join(', ')}`]
        });
      }

      // 验证日期格式和逻辑
      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          errors: ['Invalid date format']
        });
      }

      if (endDate < startDate) {
        return res.status(400).json({
          errors: ['End date cannot be earlier than start date']
        });
      }

      // 验证比赛格式
      if (!Object.values(TournamentFormat).includes(req.body.format)) {
        return res.status(400).json({
          errors: [`Invalid tournament format. Must be one of: ${Object.values(TournamentFormat).join(', ')}`]
        });
      }

      const tournamentData = {
        name: req.body.name,
        format: req.body.format,
        startDate,
        endDate,
        description: req.body.description,
        groups: req.body.groups || [],
        status: TournamentStatus.PENDING,
        players: [],
        rounds: [],
        currentRound: 0
      };

      const tournament = await this.tournamentService.createTournament(tournamentData);
      res.status(201).json(tournament);
    } catch (error: any) {
      console.error('Error creating tournament:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          errors: Object.values(error.errors).map((err: any) => err.message)
        });
      }
      res.status(500).json({
        errors: [error.message || 'Internal server error while creating tournament']
      });
    }
  }

  // Get all tournaments
  async getTournaments(req: Request, res: Response) {
    try {
      const tournaments = await this.tournamentService.getAllTournaments();
      res.json(tournaments);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Get tournament by ID
  async getTournamentById(req: Request, res: Response) {
    try {
      const tournament = await this.tournamentService.getTournamentById(req.params.id);
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }
      res.json(tournament);
    } catch (error) {
      console.error('Error fetching tournament:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Get all players
  async getAllPlayers(req: Request, res: Response) {
    try {
      const players = await Player.find()
        .select('name rank rating wins losses draws')
        .sort({ rating: -1 })
        .exec();

      res.json(players);
    } catch (error) {
      console.error('Error fetching players:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }

  // Create a new player
  async createPlayer(req: Request, res: Response) {
    try {
      const { name, rank } = req.body;

      if (!name || !rank) {
        return res.status(400).json({ message: 'Name and rank are required' });
      }

      const existingPlayer = await Player.findOne({ name });
      if (existingPlayer) {
        return res.status(400).json({ message: 'Player already exists' });
      }

      const player = await Player.create({
        name,
        rank,
        rating: 1500,
        wins: 0,
        losses: 0,
        draws: 0
      });

      res.status(201).json(player);
    } catch (error) {
      console.error('Error creating player:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }

  // Player management methods
  async getAllPlayers(req: Request, res: Response) {
    try {
      const players = await Player.find()
        .select('name rank rating')
        .sort({ rating: -1, name: 1 })
        .lean()
        .exec();
      res.json(players);
    } catch (error) {
      console.error('Error getting players:', error);
      res.status(500).json({ message: error.message });
    }
  }

  async createPlayer(req: Request, res: Response) {
    try {
      const { name, rank, rating } = req.body;
      const player = new Player({ name, rank, rating });
      await player.save();
      res.status(201).json(player);
    } catch (error) {
      console.error('Error creating player:', error);
      res.status(400).json({ message: error.message });
    }
  }

  async updatePlayer(req: Request, res: Response) {
    try {
      const { playerId } = req.params;
      const player = await this.tournamentService.updatePlayer(playerId, req.body);
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      res.json(player);
    } catch (error) {
      console.error('Error updating player:', error);
      res.status(400).json({ message: error.message });
    }
  }

  async deletePlayer(req: Request, res: Response) {
    try {
      const { playerId } = req.params;
      await this.tournamentService.deletePlayer(playerId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting player:', error);
      res.status(400).json({ message: error.message });
    }
  }

  async getPlayerById(req: Request, res: Response) {
    try {
      const { playerId } = req.params;
      const player = await this.tournamentService.getPlayerById(playerId);
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      res.json(player);
    } catch (error) {
      console.error('Error getting player:', error);
      res.status(400).json({ message: error.message });
    }
  }

  // Add players to tournament
  async addPlayer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { playerIds } = req.body;

      if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
        return res.status(400).json({ message: 'Player IDs array is required' });
      }

      const tournament = await this.tournamentService.addPlayers(id, playerIds);
      res.json(tournament);
    } catch (error) {
      console.error('Error adding players:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Generate next round
  async generateNextRound(req: Request, res: Response) {
    try {
      console.log('Generating next round - Start');
      const { id } = req.params;
      
      const tournament = await Tournament.findById(id)
        .populate('players')
        .populate('rounds.matches.player1')
        .populate('rounds.matches.player2')
        .exec();

      if (!tournament) {
        console.error('Tournament not found:', id);
        return res.status(404).json({ message: 'Tournament not found' });
      }

      console.log('Tournament found:', {
        id: tournament._id,
        format: tournament.format,
        playersCount: tournament.players.length,
        roundsCount: tournament.rounds?.length || 0
      });

      // Check if tournament has started
      if (tournament.status === TournamentStatus.PENDING) {
        console.error('Tournament has not started');
        return res.status(400).json({ message: 'Tournament has not started' });
      }

      // Check if tournament has ended
      if (tournament.status === TournamentStatus.COMPLETED) {
        console.error('Tournament has already ended');
        return res.status(400).json({ message: 'Tournament has already ended' });
      }

      // Check if there are enough players
      if (!tournament.players || tournament.players.length < 2) {
        console.error('Not enough players:', tournament.players?.length);
        return res.status(400).json({ message: 'Tournament needs at least 2 players' });
      }

      // Check if current round is completed
      const currentRound = tournament.rounds?.[tournament.rounds.length - 1];
      if (currentRound && !currentRound.completed) {
        console.error('Current round is not completed');
        return res.status(400).json({ message: 'Current round is not completed' });
      }

      console.log('Calling tournament service generatePairings');
      const updatedTournament = await this.tournamentService.generatePairings(id);
      
      if (!updatedTournament) {
        console.error('Failed to generate pairings');
        return res.status(500).json({ message: 'Failed to generate pairings' });
      }

      console.log('Next round generated successfully');
      res.json(updatedTournament);
    } catch (error: any) {
      console.error('Error in generateNextRound:', error);
      res.status(500).json({ 
        message: 'Failed to generate next round',
        error: error.message,
        stack: error.stack 
      });
    }
  }

  // Record match result
  async recordMatchResult(req: Request, res: Response) {
    try {
      const { id: tournamentId } = req.params;
      const { matchId } = req.params;
      const { winnerId } = req.body;

      console.log('Recording match result:', {
        tournamentId,
        matchId,
        winnerId,
        body: req.body
      });

      if (!winnerId) {
        return res.status(400).json({ message: 'Winner ID is required' });
      }

      const tournament = await Tournament.findById(tournamentId)
        .populate('rounds.matches.player1')
        .populate('rounds.matches.player2')
        .exec();

      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

      let matchFound = false;
      let updatedMatch = null;

      for (const round of tournament.rounds) {
        const match = round.matches.find(m => m._id.toString() === matchId);
        if (match) {
          console.log('Found match:', match);

          // 验证 winnerId 是否是这场比赛的选手之一
          const isValidWinner = 
            (match.player1 && match.player1._id.toString() === winnerId) ||
            (match.player2 && match.player2._id.toString() === winnerId);

          if (!isValidWinner) {
            return res.status(400).json({ 
              message: 'Invalid winner ID. Winner must be one of the match players',
              match: {
                player1: match.player1?._id.toString(),
                player2: match.player2?._id.toString(),
                providedWinnerId: winnerId
              }
            });
          }

          match.winner = new Types.ObjectId(winnerId);  // 使用 ObjectId
          updatedMatch = match;
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        return res.status(404).json({ message: 'Match not found' });
      }

      await tournament.save();

      // 返回更新后的比赛数据
      const updatedTournament = await Tournament.findById(tournamentId)
        .populate('rounds.matches.player1')
        .populate('rounds.matches.player2')
        .populate('rounds.matches.winner')
        .exec();

      res.json(updatedTournament);
    } catch (error) {
      console.error('Error recording match result:', error);
      res.status(500).json({ message: 'Error recording match result', error: error.message });
    }
  }

  // Update match result
  async updateMatchResult(req: Request, res: Response) {
    try {
      const { id: tournamentId } = req.params;
      const { matchId } = req.params;
      const { winnerId } = req.body;

      console.log('Updating match result:', {
        tournamentId,
        matchId,
        winnerId,
        params: req.params,
        body: req.body,
        url: req.url,
        method: req.method
      });

      if (!winnerId) {
        console.log('Winner ID is missing');
        return res.status(400).json({ message: 'Winner ID is required' });
      }

      const tournament = await Tournament.findById(tournamentId)
        .populate('rounds.matches.player1')
        .populate('rounds.matches.player2')
        .exec();

      if (!tournament) {
        console.log('Tournament not found:', tournamentId);
        return res.status(404).json({ message: 'Tournament not found' });
      }

      let matchFound = false;
      let updatedMatch = null;

      for (const round of tournament.rounds) {
        const match = round.matches.find(m => m._id.toString() === matchId);
        if (match) {
          console.log('Found match:', {
            matchId: match._id.toString(),
            player1: match.player1?._id.toString(),
            player2: match.player2?._id.toString(),
            winner: match.winner,
            providedWinnerId: winnerId
          });

          if (match.winner) {
            console.log('Match already has a winner:', match.winner);
            return res.status(400).json({ message: 'Match result already recorded' });
          }

          // 验证 winnerId 是否是这场比赛的选手之一
          const isValidWinner = 
            (match.player1 && match.player1._id.toString() === winnerId) ||
            (match.player2 && match.player2._id.toString() === winnerId);

          if (!isValidWinner) {
            console.log('Invalid winner:', {
              player1Id: match.player1?._id.toString(),
              player2Id: match.player2?._id.toString(),
              providedWinnerId: winnerId
            });
            return res.status(400).json({ 
              message: 'Invalid winner ID. Winner must be one of the match players',
              match: {
                player1: match.player1?._id.toString(),
                player2: match.player2?._id.toString(),
                providedWinnerId: winnerId
              }
            });
          }

          match.winner = winnerId;
          updatedMatch = match;
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        console.log('Match not found:', matchId);
        return res.status(404).json({ message: 'Match not found' });
      }

      console.log('Saving tournament with updated match:', {
        matchId: updatedMatch._id.toString(),
        winner: updatedMatch.winner
      });

      await tournament.save();

      res.json({
        message: 'Match result recorded successfully',
        match: updatedMatch
      });
    } catch (error) {
      console.error('Error recording match result:', error);
      res.status(500).json({ message: 'Error recording match result', error: error.message });
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

      const roundNum = parseInt(roundNumber);
      if (isNaN(roundNum)) {
        return res.status(400).json({ message: 'Invalid round number' });
      }

      tournament.rounds = tournament.rounds.filter(r => r.roundNumber < roundNum);

      if (tournament.rounds.length === 0) {
        tournament.status = TournamentStatus.UPCOMING;
      } else if (tournament.status === TournamentStatus.COMPLETED) {
        tournament.status = TournamentStatus.ONGOING;
      }

      await tournament.save();

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
        .exec();

      res.json(updatedTournament);
    } catch (error) {
      console.error('Error deleting round:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }

  // Delete current round
  async deleteCurrentRound(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log('Deleting current round for tournament:', id);

      const tournament = await Tournament.findById(id);
      if (!tournament) {
        return res.status(404).json({
          message: 'Tournament not found'
        });
      }

      // 检查是否有轮次可以删除
      if (!tournament.rounds || tournament.rounds.length === 0) {
        return res.status(400).json({
          message: 'No rounds to delete'
        });
      }

      // 删除最后一轮
      tournament.rounds.pop();
      tournament.currentRound = Math.max(1, tournament.currentRound - 1);

      // 如果删除了所有轮次，重置比赛状态
      if (tournament.rounds.length === 0) {
        tournament.status = TournamentStatus.PENDING;
        tournament.currentRound = 1;
      }

      await tournament.save();
      
      const updatedTournament = await Tournament.findById(id)
        .populate('players')
        .exec();

      console.log('Current round deleted successfully');
      res.json(updatedTournament);
    } catch (error: any) {
      console.error('Error deleting current round:', error);
      res.status(500).json({
        message: error.message || 'Failed to delete current round'
      });
    }
  }

  // Delete a round
  async deleteRound(req: Request, res: Response) {
    try {
      const { tournamentId, roundNumber } = req.params;
      const tournament = await this.tournamentService.deleteRound(tournamentId, parseInt(roundNumber));
      res.json(tournament);
    } catch (error) {
      console.error('Error in deleteRound:', error);
      res.status(500).json({ message: error.message });
    }
  }

  // Update tournament
  async updateTournament(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const { name, format, startDate, endDate, description } = req.body;

      if (!name || !format || !startDate || !endDate) {
        return res.status(400).json({ 
          message: 'Missing required fields: name, format, startDate, endDate' 
        });
      }

      const tournament = await Tournament.findById(id);
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

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
    } catch (error) {
      console.error('Error updating tournament:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }

  // Delete player
  async deletePlayer(req: Request, res: Response) {
    try {
      const id = req.params.id;
      
      const player = await Player.findById(id);
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }

      const tournaments = await Tournament.find({ players: id });
      if (tournaments.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete player who is in tournaments' 
        });
      }

      await Player.findByIdAndDelete(id);
      res.json({ message: 'Player deleted successfully' });
    } catch (error) {
      console.error('Error deleting player:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }

  // Get tournament results
  async getTournamentResults(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tournament = await Tournament.findById(id)
        .populate('players')
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
        .exec();

      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

      const sortedPlayers = this.tournamentService.getSortedPlayers(tournament);
      const results = sortedPlayers.map((item, index) => ({
        rank: index + 1,
        player: {
          _id: item.player._id,
          name: item.player.name,
          rank: item.player.rank
        },
        score: item.score,
        opponentScore: item.opponentScore,
        totalScore: item.totalScore,
        wins: tournament.rounds.reduce((wins, round) => 
          wins + round.matches.filter(match => 
            match.winner && match.winner._id.toString() === item.player._id.toString()
          ).length, 0),
        losses: tournament.rounds.reduce((losses, round) => 
          losses + round.matches.filter(match => 
            match.winner && 
            (match.player1._id.toString() === item.player._id.toString() || 
             match.player2._id.toString() === item.player._id.toString()) &&
            match.winner._id.toString() !== item.player._id.toString()
          ).length, 0)
      }));

      res.json({
        _id: tournament._id,
        name: tournament.name,
        format: tournament.format,
        results: results
      });
    } catch (error) {
      console.error('Error getting tournament results:', error);
      res.status(500).json({ message: 'Error getting tournament results' });
    }
  }

  // 临时方法：统一比赛格式
  async normalizeFormats(req: Request, res: Response) {
    try {
      // 更新所有 knockout 为 SINGLEELIMINATION
      await Tournament.updateMany(
        { format: 'knockout' },
        { $set: { format: TournamentFormat.SINGLEELIMINATION } }
      );

      // 更新所有 roundrobin 为 ROUNDROBIN
      await Tournament.updateMany(
        { format: 'roundrobin' },
        { $set: { format: TournamentFormat.ROUNDROBIN } }
      );

      res.json({ message: '比赛格式已统一更新' });
    } catch (error) {
      console.error('Error normalizing tournament formats:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }

  // Delete tournament
  async deleteTournament(req: Request, res: Response) {
    try {
      const { tournamentId } = req.params;

      const tournament = await Tournament.findById(tournamentId);
      if (!tournament) {
        return res.status(404).json({
          message: 'Tournament not found'
        });
      }

      // 删除比赛相关的所有数据
      await Tournament.findByIdAndDelete(tournamentId);

      res.json({ message: 'Tournament deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting tournament:', error);
      res.status(500).json({
        message: error.message || 'Failed to delete tournament'
      });
    }
  }

  // Start tournament
  async startTournament(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log('Starting tournament:', id);

      const tournament = await Tournament.findById(id).populate('players');
      if (!tournament) {
        return res.status(404).json({
          message: 'Tournament not found'
        });
      }

      // 检查是否有足够的选手
      if (!tournament.players || tournament.players.length < 2) {
        return res.status(400).json({
          message: 'Need at least 2 players to start the tournament'
        });
      }

      // 检查比赛状态
      if (tournament.status !== TournamentStatus.PENDING) {
        return res.status(400).json({
          message: 'Tournament has already started or is completed'
        });
      }

      // 根据比赛类型生成第一轮比赛
      const firstRound = await this.tournamentService.generatePairings(id);
      if (!firstRound) {
        return res.status(500).json({
          message: 'Failed to generate first round matches'
        });
      }

      // 返回更新后的比赛信息
      res.json(firstRound);
    } catch (error) {
      console.error('Error starting tournament:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to start tournament'
      });
    }
  }
}
