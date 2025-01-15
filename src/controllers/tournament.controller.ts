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
          select: 'name rank _id'
        })
        .populate({
          path: 'rounds.matches.player2',
          select: 'name rank _id'
        })
        .populate({
          path: 'rounds.matches.winner',
          select: 'name rank _id'
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
          select: 'name rank _id'
        })
        .populate({
          path: 'rounds.matches.player2',
          select: 'name rank _id'
        })
        .populate({
          path: 'rounds.matches.winner',
          select: 'name rank _id'
        })
        .exec();

      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

      // 获取当前轮次编号
      const currentRoundNumber = tournament.rounds.length;
      
      // 将 playerScores 转换为 Map 以便快速查找
      const playerScores = new Map(
        tournament.playerScores?.map(score => [
          score.player.toString(),
          {
            currentScore: score.currentScore || 0,
            wins: score.wins || 0,
            losses: score.losses || 0
          }
        ]) || []
      );

      // 获取所有玩家信息
      const players = tournament.players;
      
      console.log('从数据库读取的 playerScores:', Array.from(playerScores.entries()).map(([playerId, score]) => {
        const player = players.find(p => p._id.toString() === playerId);
        return {
          playerName: player ? player.name : 'Unknown Player',
          currentScore: score.currentScore
        };
      }));

      // 为每个选手添加分数
      const playersWithScores = tournament.players.map((player: any) => {
        const playerScore = playerScores.get(player._id.toString()) || {
          currentScore: 0,
          wins: 0,
          losses: 0
        };

        // 计算上一轮得分
        let previousScore = playerScore.currentScore;  //把选手得分转成上一轮得分，准备更新得分
        if (currentRoundNumber > 1) {
          // 在倒数第二轮的比赛中找到这个选手的比赛
          const lastRound = tournament.rounds[currentRoundNumber - 2];
          console.log('检查倒数第二轮比赛（倒查两轮，实际不是倒两轮:', {
            roundNumber: currentRoundNumber - 1,
            matchCount: lastRound?.matches?.length || 0
          });

          // 打印所有比赛的详细信息
          console.log('倒数第二轮所有比赛的原始数据:', lastRound.matches.map(m => ({
            matchId: m._id.toString(),
            //player1: m.player1?._id?.toString(),
            player1: {
              id: m.player1?._id?.toString(),
              name: m.player1?.name,
              rank: m.player1?.rank
            },
            //player2: m.player2?._id?.toString(),
            player2: {
              id: m.player2?._id?.toString(),
              name: m.player2?.name,
              rank: m.player2?.rank
            },
            winner: {
              value: m.winner,
              type: typeof m.winner,
              isObjectId: m.winner instanceof Types.ObjectId,
              toString: m.winner?.toString(),
              raw: m.winner
            },
            rawMatch: m
          })));

          const match = lastRound.matches.find(m => 
            m.player1?._id?.toString() === player._id.toString() || 
            m.player2?._id?.toString() === player._id.toString()
          );
          
          if (match) {
            console.log('找到选手的比赛:', {
              playerName: player.name,
              matchId: match._id.toString(),
              player1Id: match.player1?._id?.toString(),
              player2Id: match.player2?._id?.toString(),
              winnerId: match.winner?.toString()
            });

            if (match.winner) {
              console.log('比赛有胜者:', {
                playerName: player.name,
                winnerId: match.winner.toString(),
                isThisPlayerWinner: match.winner.toString() === player._id.toString()
              });

              // 如果这个选手赢了，那么当前分数比上一轮多2分
              if (match.winner.toString() === player._id.toString()) {
                //previousScore = playerScore.currentScore - 2; //这个算法莫名其妙，不知道AI是要干什么
                playerScore.currentScore = previousScore + 2;
                console.log('选手赢了, 当前分数比上一轮多2分');
              }
            } else {
              console.log('比赛没有胜者');
            }
          } else {
            console.log('没有找到选手的比赛:', {
              playerName: player.name,
              playerId: player._id.toString()
            });
          }
        }
        // 添加日志显示得分变化
        console.log('选手得分情况:', {
          name: player.name,
          playerId: player._id.toString(),
          roundNumber: currentRoundNumber,
          previousScore: previousScore,
          currentScore: playerScore.currentScore,
          delta: playerScore.currentScore - previousScore
        });

        return {
          ...player.toObject(),
          currentScore: playerScore.currentScore,
          wins: playerScore.wins,
          losses: playerScore.losses
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

      // 获取比赛信息
      const tournament = await Tournament.findById(id);
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

      console.log('Tournament format:', tournament.format);
      //console.log('Current round:', tournament.rounds?.length > 0 ? tournament.rounds[tournament.rounds.length - 1] : 'undefined');

      // 检查当前轮次是否完成
      if (tournament.rounds?.length > 0) {
        const currentRound = tournament.rounds[tournament.rounds.length - 1];
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

      // 返回更新后的比赛信息
      res.json(updatedTournament);
    } catch (error: any) {
      console.error('Error generating next round:', error);
      res.status(500).json({ message: error.message });
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
      let currentMatch = null;

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

          match.winner = new Types.ObjectId(winnerId);  // 转换为 ObjectId
          currentMatch = match;
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        return res.status(404).json({ message: 'Match not found' });
      }

      await tournament.save();

      console.log('Tournament saved with updated match:', {
        matchId: currentMatch._id.toString(),
        winner: currentMatch.winner,
        winnerType: typeof currentMatch.winner,
        isObjectId: currentMatch.winner instanceof Types.ObjectId
      });

      // 调用 updateTournamentResults 来更新得分

      const updatedTournament = await this.tournamentService.updateTournamentResults(
        tournamentId,
        matchId,
        winnerId,
        ''  // 如果没有 result 字段，就传空字符串
      );

      if (!updatedTournament) {
        return res.status(500).json({ message: 'Failed to update tournament results' });
      }

      // 从更新后的 tournament 中找到对应的 match
      const savedMatch = updatedTournament.rounds
        .flatMap(r => r.matches)
        .find(m => m._id.toString() === matchId);

      console.log('Updated tournament result:', {
        tournamentId,
        matchId,
        winner: savedMatch?.winner,
        playerScores: updatedTournament.playerScores
      });

      res.json({
        message: 'Match result recorded successfully',
        tournament: updatedTournament
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
      //let updatedMatch = null;

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

          match.winner = new Types.ObjectId(winnerId);  // 转换为 ObjectId
          currentMatch = match;
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        console.log('Match not found:', matchId);
        return res.status(404).json({ message: 'Match not found' });
      }

      await tournament.save();

      console.log('Tournament saved with updated match:', {
        matchId: currentMatch._id.toString(),
        winner: currentMatch.winner,
        winnerType: typeof currentMatch.winner,
        isObjectId: currentMatch.winner instanceof Types.ObjectId
      });

      // 调用 updateTournamentResults 来更新得分

      const updatedTournament = await this.tournamentService.updateTournamentResults(
        tournamentId,
        matchId,
        winnerId,
        ''  // 如果没有 result 字段，就传空字符串
      );

      if (!updatedTournament) {
        return res.status(500).json({ message: 'Failed to update tournament results' });
      }

      // 从更新后的 tournament 中找到对应的 match
      //const updatedMatch = updatedTournament.rounds
      const savedMatch = updatedTournament.rounds
        .flatMap(r => r.matches)
        .find(m => m._id.toString() === matchId);

      console.log('Updated tournament result:', {
        tournamentId,
        matchId,
        winner: savedMatch?.winner,
        playerScores: updatedTournament.playerScores
      });

      res.json({
        message: 'Match result recorded successfully',
        tournament: updatedTournament
      });

      /*
      await this.tournamentService.updateTournamentResults(
        tournamentId,
        matchId,
        winnerId,
        updatedMatch.result || ''
      );

     //await tournament.save();   //不要再save (对吗？) TXY 202/01/07

      res.json({
        message: 'Match result recorded successfully',
        //match: updatedMatch
        tournament: updatedTournament
      });  */

    } catch (error) {
      console.error('Error recording match result:', error);
      res.status(500).json({ message: 'Error recording match result', error: error.message });
    }
  }

  // Delete round
  async deleteRound(req: Request, res: Response) {
    try {
      const { id, roundNumber } = req.params;
      console.log('Deleting round:', { id, roundNumber });
      
      const tournament = await Tournament.findById(id);
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

      const roundNum = parseInt(roundNumber);
      if (isNaN(roundNum)) {
        return res.status(400).json({ message: 'Invalid round number' });
      }

      console.log('Current tournament rounds:', tournament.rounds.map(r => ({ 
        roundNumber: r.roundNumber,
        matchCount: r.matches.length,
        completedMatches: r.matches.filter(m => m.winner).length
      })));

      // 获取要删除的轮次中的所有比赛
      const roundToDelete = tournament.rounds[roundNum - 1];  // 轮次号从1开始，数组索引从0开始
      if (!roundToDelete) {
        return res.status(404).json({ message: 'Round not found' });
      }

      console.log('Found round to delete:', {
        roundNumber: roundToDelete.roundNumber,
        matchCount: roundToDelete.matches.length,
        matches: roundToDelete.matches.map(m => ({
          player1: m.player1,
          player2: m.player2,
          winner: m.winner
        }))
      });

      // 更新选手得分
      const playerScores = new Map(tournament.playerScores?.map(score => [score.player.toString(), score]) || []);
      
      roundToDelete.matches.forEach(match => {
        if (match.winner) {
          const winner = playerScores.get(match.winner.toString());
          if (winner) {
            console.log('Updating winner score:', {
              playerId: match.winner.toString(),
              oldScore: winner.currentScore,
              newScore: winner.currentScore - 2
            });
            winner.currentScore -= 2; // 减去胜利得分
            winner.opponents = winner.opponents?.filter(opp => 
              opp.toString() !== match.player1.toString() && 
              opp.toString() !== match.player2.toString()
            );
          }

          const loser = playerScores.get(
            match.player1.toString() === match.winner.toString() 
              ? match.player2.toString() 
              : match.player1.toString()
          );
          if (loser) {
            console.log('Updating loser opponents:', {
              playerId: loser.player.toString(),
              oldOpponents: loser.opponents?.map(o => o.toString()),
              newOpponents: loser.opponents?.filter(opp => 
                opp.toString() !== match.player1.toString() && 
                opp.toString() !== match.player2.toString()
              ).map(o => o.toString())
            });
            loser.opponents = loser.opponents?.filter(opp => 
              opp.toString() !== match.player1.toString() && 
              opp.toString() !== match.player2.toString()
            );
          }
        }
      });

      tournament.playerScores = Array.from(playerScores.values());

      // 删除该轮次及之后的所有轮次
      tournament.rounds = tournament.rounds.filter((_, index) => index < roundNum - 1);

      if (tournament.rounds.length === 0) {
        tournament.status = TournamentStatus.UPCOMING;
      } else if (tournament.status === TournamentStatus.COMPLETED) {
        tournament.status = TournamentStatus.ONGOING;
      }

      console.log('Tournament after updates:', {
        roundsCount: tournament.rounds.length,
        status: tournament.status,
        playerScores: Array.from(playerScores.entries()).map(([id, score]) => ({
          playerId: id,
          currentScore: score.currentScore,
          opponentsCount: score.opponents?.length
        }))
      });

      await tournament.save();

      const updatedTournament = await Tournament.findById(id)
        .populate('players', 'name rank')
        .populate({
          path: 'rounds.matches.player1',
          select: 'name rank _id'
        })
        .populate({
          path: 'rounds.matches.player2',
          select: 'name rank _id'
        })
        .populate({
          path: 'rounds.matches.winner',
          select: 'name rank _id'
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
          select: 'name rank _id'
        })
        .populate({
          path: 'rounds.matches.player2',
          select: 'name rank _id'
        })
        .populate({
          path: 'rounds.matches.winner',
          select: 'name rank _id'
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
        gamePoints: item.score,  // 对于 SWISS 赛制，gamePoints 就是胜场数 * 2
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
        results
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

  // End tournament
  async endTournament(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const tournament = await Tournament.findById(id);
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' });
      }

      // 检查是否所有轮次都已完成
      const allRoundsCompleted = tournament.rounds?.every(round => 
        round.matches.every(match => match.winner != null)
      ) || false;

      if (!allRoundsCompleted) {
        return res.status(400).json({ 
          message: 'Cannot end tournament until all matches have results' 
        });
      }

      tournament.status = TournamentStatus.COMPLETED;
      await tournament.save();

      // 返回更新后的比赛信息
      const updatedTournament = await Tournament.findById(id)
        .populate('players')
        .populate({
          path: 'rounds.matches.player1',
          select: 'name rank _id'
        })
        .populate({
          path: 'rounds.matches.player2',
          select: 'name rank _id'
        })
        .populate({
          path: 'rounds.matches.winner',
          select: 'name rank _id'
        })
        .exec();

      res.json(updatedTournament);
    } catch (error) {
      console.error('Error ending tournament:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }
}
