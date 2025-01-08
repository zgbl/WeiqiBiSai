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
      const { 
        name, 
        format, 
        startDate, 
        endDate, 
        description,
        // McMahon specific fields
        upperBar,
        initialScore,
        minimumScore,
        roundCount,
        groups
      } = req.body;
      
      if (!name || !format || !startDate || !endDate) {
        return res.status(400).json({ 
          message: 'Missing required fields: name, format, startDate, endDate' 
        });
      }

      // 确保格式统一为大写枚举值
      let normalizedFormat = format.toUpperCase();
      if (!Object.values(TournamentFormat).includes(normalizedFormat as TournamentFormat)) {
        return res.status(400).json({
          message: `Invalid tournament format. Must be one of: ${Object.values(TournamentFormat).join(', ')}`
        });
      }

      // 验证 McMahon 特定字段
      if (normalizedFormat === TournamentFormat.MCMAHON) {
        if (upperBar === undefined || initialScore === undefined || minimumScore === undefined || roundCount === undefined) {
          return res.status(400).json({
            message: 'McMahon tournament requires: upperBar, initialScore, minimumScore, roundCount'
          });
        }
      }

      const tournament = await this.tournamentService.createTournament({
        name,
        format: normalizedFormat as TournamentFormat,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        description,
        status: TournamentStatus.UPCOMING,
        players: [],
        rounds: [],
        // McMahon specific fields
        ...(normalizedFormat === TournamentFormat.MCMAHON && {
          upperBar,
          initialScore,
          minimumScore,
          roundCount,
          groups: groups || ['业余组', '职业组'], // 默认分组
          playerScores: [] // 初始化空的选手分数列表
        })
      });

      res.status(201).json(tournament);
    } catch (error) {
      console.error('Error creating tournament:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }

  // Get all tournaments
  async getTournaments(req: Request, res: Response) {
    try {
      const tournaments = await Tournament.find()
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

      res.json(tournaments);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }

  // Get tournament by ID
  async getTournamentById(req: Request, res: Response) {
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

      // 计算每个选手的分数
      const scores = this.tournamentService.calculatePlayerScores(tournament);
      
      // 为每个选手添加分数
      const playersWithScores = tournament.players.map((player: any) => {
        const { score, gamePoints } = this.tournamentService.getPlayerScore(scores, player._id.toString());
        return {
          ...player.toObject(),
          score,
          gamePoints
        };
      });

      // 更新 tournament 对象中的 players
      const tournamentData = tournament.toObject();
      tournamentData.players = playersWithScores;

      res.json(tournamentData);
    } catch (error) {
      console.error('Error getting tournament:', error);
      res.status(500).json({ message: 'Error getting tournament' });
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

  // Add player to tournament
  async addPlayer(req: Request, res: Response) {
    try {
      const { id:tournamentId } = req.params;
      const { playerId } = req.body;

      if (!playerId) {
        return res.status(400).json({ message: 'Player ID is required' });
      }

      const tournament = await Tournament.findById(tournamentId)
        .populate('players', 'name rank rating')
        .exec();

      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

      if (tournament.status !== TournamentStatus.UPCOMING) {
        return res.status(400).json({ message: 'Cannot add players after tournament has started' });
      }

      const player = await Player.findById(playerId);
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }

      // Check if player already exists in tournament
      const playerExists = tournament.players.some(p => 
        p._id?.toString() === player._id.toString()
      );

      if (playerExists) {
        return res.status(400).json({ message: 'Player already in tournament' });
      }

      // Add player to tournament
      tournament.players.push(player._id);
      await tournament.save();

      // Fetch updated tournament with populated player data
      const updatedTournament = await Tournament.findById(tournamentId)
        .populate({
          path: 'players',
          select: 'name rank rating'
        })
        .exec();

      console.log('Updated tournament:', updatedTournament);
      res.json(updatedTournament);
    } catch (error) {
      console.error('Error adding player to tournament:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }

  // Generate next round
  async generateNextRound(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log('Generating next round for tournament:', id);

      const tournament = await Tournament.findById(id)
        .populate('players')
        .populate('rounds.matches.player1')
        .populate('rounds.matches.player2')
        .populate('rounds.matches.winner')
        .exec();

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      console.log('Tournament format:', tournament.format);

      // 检查是否可以生成下一轮
      const currentRound = tournament.rounds[tournament.rounds.length - 1];
      console.log('Current round:', currentRound);
      if (currentRound) {
        const isRoundComplete = currentRound.matches.every(match => match.winner != null);
        if (!isRoundComplete) {
          throw new Error('Cannot generate next round until all matches in current round have results');
        }
        currentRound.completed = true;  // 标记当前轮次为已完成
      }

      // 生成下一轮比赛
      const updatedTournament = await this.tournamentService.generatePairings(id);
      if (!updatedTournament) {
        throw new Error('Failed to generate pairings');
      }

      // 保存更改
      const savedTournament = await Tournament.findByIdAndUpdate(
        id,
        {
          $set: {
            rounds: updatedTournament.rounds,
            status: updatedTournament.status,
            playerScores: updatedTournament.playerScores
          }
        },
        { new: true }
      )
      .populate('players')
      .populate('rounds.matches.player1')
      .populate('rounds.matches.player2')
      .populate('rounds.matches.winner')
      .exec();

      if (!savedTournament) {
        throw new Error('Failed to save tournament');
      }

      console.log('Updated tournament:', {
        roundsCount: savedTournament.rounds.length,
        lastRound: savedTournament.rounds[savedTournament.rounds.length - 1]
      });

      res.json(savedTournament);
    } catch (error) {
      console.error('Error generating next round:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to generate next round' 
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
}
