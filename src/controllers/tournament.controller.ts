import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { TournamentService } from '../services/tournament.service';
import { TournamentFormat, TournamentStatus } from '../types/tournament.types';
import Tournament from '../models/tournament.model';
import Player from '../models/player.model';
import { toObjectId } from '../types/mongoose.types';

const tournamentService = new TournamentService();

export class TournamentController {
  // Create a new tournament
  async createTournament(req: Request, res: Response) {
    try {
      const { name, format, startDate, endDate, description } = req.body;
      
      if (!name || !format || !startDate || !endDate) {
        return res.status(400).json({ 
          message: 'Missing required fields: name, format, startDate, endDate' 
        });
      }

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
      const tournaments = await tournamentService.getAllTournaments();
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
      const tournament = await Tournament.findById(req.params.id)
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
        
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }
      res.json(tournament);
    } catch (error) {
      console.error('Error fetching tournament:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
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
        .lean()
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
      const { id: tournamentId } = req.params;
      console.log('DEBUG: Starting generateNextRound');
      console.log('DEBUG: Tournament ID:', tournamentId);

      const tournament = await Tournament.findById(tournamentId)
        .populate('players', 'name rank')
        .exec();

      console.log('DEBUG: Raw tournament:', tournament);
      console.log('DEBUG: Tournament found:', tournament ? 'yes' : 'no');
      if (tournament) {
        console.log('DEBUG: Tournament players array:', tournament.players);
        console.log('DEBUG: Number of players:', tournament.players.length);
        tournament.players.forEach((player, index) => {
          console.log(`DEBUG: Player ${index + 1}:`, {
            _id: player._id?.toString(),
            name: player.name,
            rank: player.rank
          });
        });
      }

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // 获取比赛的最新状态，包括所有轮次信息
      const fullTournament = await Tournament.findById(tournamentId)
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

      if (!fullTournament) {
        throw new Error('Tournament not found');
      }

      if (fullTournament.status === TournamentStatus.UPCOMING) {
        if (fullTournament.format === TournamentFormat.ROUNDROBIN) {
          const players = tournament.players;
          console.log('DEBUG: Players array before processing:', players);
          console.log('DEBUG: Players array type:', Array.isArray(players) ? 'Array' : typeof players);
          
          const n = players.length;
          console.log('DEBUG: Number of players:', n);
          
          if (n < 2) {
            throw new Error('Need at least 2 players to start the tournament');
          }
          
          // Generate all rounds of matches
          const rounds = [];
          const totalRounds = n % 2 === 0 ? n - 1 : n;
          console.log('DEBUG: Total rounds:', totalRounds);
          
          // Create a copy of players array for rotation
          let roundPlayers = [...players];
          if (n % 2 !== 0) {
            roundPlayers.push(null); // Add a bye for odd number of players
          }
          
          const numPairs = Math.floor(roundPlayers.length / 2);
          console.log('DEBUG: Players for pairing:', roundPlayers);
          
          for (let round = 0; round < totalRounds; round++) {
            console.log('DEBUG: Generating round:', round + 1);
            const matches = [];
            
            for (let i = 0; i < numPairs; i++) {
              const player1 = roundPlayers[i];
              const player2 = roundPlayers[roundPlayers.length - 1 - i];
              
              console.log('DEBUG: Match pairing:', {
                player1: player1 ? {
                  _id: player1._id,
                  name: player1.name,
                  rank: player1.rank
                } : 'bye',
                player2: player2 ? {
                  _id: player2._id,
                  name: player2.name,
                  rank: player2.rank
                } : 'bye'
              });
              
              matches.push({
                player1: player1 ? player1._id : null,
                player2: player2 ? player2._id : null,
                winner: null,
                result: ''
              });
            }
            
            console.log('DEBUG: Round matches:', matches);
            
            rounds.push({
              roundNumber: round + 1,
              matches,
              completed: false
            });
            
            // Rotate players for next round (keeping first player fixed)
            const firstPlayer = roundPlayers[0];
            const remainingPlayers = roundPlayers.slice(1);
            remainingPlayers.unshift(remainingPlayers.pop()!);
            roundPlayers = [firstPlayer, ...remainingPlayers];
          }
          
          console.log('DEBUG: Final rounds:', rounds);
          
          tournament.rounds = rounds;
          tournament.status = TournamentStatus.ONGOING;
          
          const updatedTournament = await tournament.save();
          console.log('DEBUG: Saved tournament:', updatedTournament);
          
          // Return populated tournament data
          const populatedTournament = await Tournament.findById(updatedTournament._id)
            .populate('players', 'name rank')
            .populate('rounds.matches.player1', 'name rank')
            .populate('rounds.matches.player2', 'name rank')
            .populate('rounds.matches.winner', 'name rank')
            .lean()
            .exec();
          
          console.log('DEBUG: Final populated tournament:', populatedTournament);
          
          return res.json(populatedTournament);
        }
        
        throw new Error('Unsupported tournament format');
      }

      const currentRound = tournament.rounds[tournament.rounds.length - 1];
      if (!currentRound?.completed) {
        throw new Error('Current round is not complete');
      }

      if (tournament.format === TournamentFormat.ROUNDROBIN) {
        const nextRoundIndex = tournament.rounds.findIndex(r => !r.completed);
        if (nextRoundIndex === -1) {
          throw new Error('All rounds are completed');
        }

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
    } catch (error) {
      console.error('DEBUG: Error in generateNextRound:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
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
          if (match.winner) {
            return res.status(400).json({ message: 'Match result already recorded' });
          }

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

          match.winner = winnerId;
          updatedMatch = match;
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        return res.status(404).json({ message: 'Match not found' });
      }

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
        .lean()
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
        .populate('rounds.matches.player1')
        .populate('rounds.matches.player2')
        .populate('rounds.matches.winner')
        .exec();

      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

      // 计算每个选手的胜负场次
      const playerStats = new Map();

      // 初始化所有选手的统计数据
      tournament.players.forEach(player => {
        playerStats.set(player._id.toString(), {
          playerId: player._id.toString(),
          player: {
            _id: player._id,
            name: player.name,
            rank: player.rank
          },
          wins: 0,
          losses: 0
        });
      });

      // 统计每场比赛的结果
      tournament.rounds.forEach(round => {
        round.matches.forEach(match => {
          if (match.winner) {
            const winnerId = match.winner._id.toString();
            const player1Id = match.player1._id.toString();
            const player2Id = match.player2._id.toString();

            // 获取胜者和负者的ID
            const loserId = player1Id === winnerId ? player2Id : player1Id;

            const winnerStats = playerStats.get(winnerId);
            const loserStats = playerStats.get(loserId);

            if (winnerStats) {
              winnerStats.wins += 1;
              console.log(`Player ${winnerStats.player.name} won against ${loserStats?.player.name}`);
            }
            if (loserStats) {
              loserStats.losses += 1;
              console.log(`Player ${loserStats.player.name} lost to ${winnerStats?.player.name}`);
            }
          }
        });
      });

      // 转换为数组并排序
      const results = Array.from(playerStats.values())
        .sort((a, b) => {
          // 首先按胜场数降序
          if (b.wins !== a.wins) return b.wins - a.wins;
          // 如果胜场数相同，按负场数升序
          if (a.losses !== b.losses) return a.losses - b.losses;
          // 如果胜负场数都相同，按段位降序排列（假设段位格式为 "Nd"，N 越大段位越高）
          const rankA = parseInt(a.player.rank) || 0;
          const rankB = parseInt(b.player.rank) || 0;
          return rankB - rankA;
        })
        .map((stats, index) => ({
          player: stats.player,
          wins: stats.wins,
          losses: stats.losses,
          rank: index + 1
        }));

      console.log('Final results:', results);

      res.json({
        _id: tournament._id,
        name: tournament.name,
        format: tournament.format,
        results: results
      });
    } catch (error) {
      console.error('Error getting tournament results:', error);
      res.status(500).json({ message: 'Error getting tournament results', error: error.message });
    }
  }
}
