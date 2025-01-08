import { Types, Document } from 'mongoose';
import Tournament from '../models/tournament.model';
import Player from '../models/player.model';
import { 
  IMatch, 
  IRound, 
  ITournament, 
  TournamentFormat, 
  TournamentStatus,
  TournamentDocument 
} from '../types/tournament.types';
import { MongoId, toObjectId, toString } from '../types/mongoose.types';

interface PlayerDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  rank: string;
  rating?: number;
  wins: number;
  losses: number;
  draws: number;
}

interface PopulatedTournament extends Document {
  _id: Types.ObjectId;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: Date;
  endDate: Date;
  players: PlayerDocument[];
  rounds: IRound[];
  description?: string;
}

type TournamentPlayer = PlayerDocument | null;

function convertToTournamentDocument(populated: PopulatedTournament): TournamentDocument {
  const doc = populated.toObject();
  return {
    ...doc,
    players: doc.players.map((p: PlayerDocument) => p._id)
  } as TournamentDocument;
}

export class TournamentService {
  async createTournament(tournamentData: Partial<ITournament>) {
    console.log('Creating tournament with data:', tournamentData);

    // 对于 McMahon 赛制，确保所有必要字段都存在
    if (tournamentData.format === TournamentFormat.MCMAHON) {
      const { upperBar, initialScore, minimumScore, roundCount } = tournamentData;

      // 检查分数设置是否合理
      if (minimumScore > initialScore) {
        throw new Error('Minimum score cannot be greater than initial score');
      }

      // 检查轮数是否合理
      if (roundCount < 1) {
        throw new Error('Round count must be at least 1');
      }

      // 初始化空的 playerScores 数组
      tournamentData.playerScores = [];
    }

    const tournament = new Tournament(tournamentData);
    return await tournament.save();
  }

  async getAllTournaments() {
    return await Tournament.find()
      .populate('players', 'name rank')
      .lean()
      .exec();
  }

  async getTournamentById(id: string): Promise<TournamentDocument | null> {
    return Tournament.findById(id).exec();
  }

  // Generate pairings for the next round
  async generatePairings(tournamentId: string): Promise<TournamentDocument | null> {
    const tournament = await Tournament.findById(tournamentId)
      .populate<{ players: PlayerDocument[] }>('players')
      .exec() as PopulatedTournament | null;

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const allPlayers = tournament.players;
    if (!allPlayers || allPlayers.length === 0) {
      throw new Error('No players in tournament');
    }

    // 获取当前轮次号
    const currentRoundNumber = tournament.rounds && tournament.rounds.length > 0 
      ? Math.max(...tournament.rounds.map(r => r.roundNumber)) + 1 
      : 1;

    // 如果是第一轮，设置初始分数
    if (currentRoundNumber === 1 && (!tournament.playerScores || tournament.playerScores.length === 0)) {
      await this.setInitialScores(tournament);
    }

    // 获取当前所有选手的得分情况
    const playerScores = new Map();
    
    console.log('=== [后台] 开始计算选手得分 ===');
    
    // 如果是第一轮，使用初始分数
    if (currentRoundNumber === 1) {
      tournament.playerScores?.forEach(score => {
        console.log(`第一轮初始分数 - 选手 ${score.player.name}:`, {
          initialScore: score.initialScore,
          currentScore: score.currentScore,
          variable: 'score.initialScore/currentScore'
        });
        
        playerScores.set(score.player.toString(), {
          currentScore: score.initialScore,
          wins: score.wins,
          losses: score.losses,
          draws: score.draws,
          opponents: score.opponents || []
        });
      });
    } else {
      // 如果不是第一轮，累加之前轮次的得分
      tournament.playerScores?.forEach(score => {
        console.log(`非第一轮当前分数 - 选手 ${score.player.name}:`, {
          currentScore: score.currentScore,
          variable: 'score.currentScore'
        });
        
        playerScores.set(score.player.toString(), {
          currentScore: score.currentScore, // 使用当前分数
          wins: score.wins,
          losses: score.losses,
          draws: score.draws,
          opponents: score.opponents || []
        });
      });

      // 添加每轮比赛的得分
      tournament.rounds.forEach((round, roundIndex) => {
        console.log(`计算第 ${roundIndex + 1} 轮得分`);
        round.matches.forEach(match => {
          if (match.winner) {
            const winnerScore = playerScores.get(match.winner.toString());
            if (winnerScore) {
              const oldScore = winnerScore.currentScore;
              winnerScore.currentScore += 2; // 胜者增加2分
              winnerScore.wins += 1;
              playerScores.set(match.winner.toString(), winnerScore);
              
              console.log(`胜者得分更新 - ${match.winner.name}:`, {
                oldScore,
                newScore: winnerScore.currentScore,
                variable: 'winnerScore.currentScore'
              });
            }

            const loserId = match.player1.toString() === match.winner.toString() 
              ? match.player2.toString() 
              : match.player1.toString();
            const loserScore = playerScores.get(loserId);
            if (loserScore) {
              loserScore.losses += 1;
              playerScores.set(loserId, loserScore);
              
              console.log(`败者得分 - ${loserId}:`, {
                score: loserScore.currentScore,
                variable: 'loserScore.currentScore'
              });
            }
          }
        });
      });
    }

    // 确保所有选手都有得分记录
    allPlayers.forEach(player => {
      if (!playerScores.has(player._id.toString())) {
        console.log(`初始化选手得分 - ${player.name}:`, {
          score: 0,
          variable: 'playerScores.get(player._id).currentScore'
        });
        
        playerScores.set(player._id.toString(), {
          currentScore: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          opponents: []
        });
      }
    });

    console.log('=== [后台] 最终选手得分 ===');
    Array.from(playerScores.entries()).forEach(([playerId, scoreData]) => {
      const player = allPlayers.find(p => p._id.toString() === playerId);
      console.log(`选手 ${player?.name}:`, {
        currentScore: scoreData.currentScore,
        wins: scoreData.wins,
        losses: scoreData.losses,
        variable: 'playerScores.get(playerId).currentScore'
      });
    });

    // 根据当前得分对选手进行排序
    const sortedPlayers = allPlayers.sort((a, b) => {
      const scoreA = playerScores.get(a._id.toString())?.currentScore || 0;
      const scoreB = playerScores.get(b._id.toString())?.currentScore || 0;
      return scoreB - scoreA;
    });

    const matches: IMatch[] = [];
    const paired = new Set<string>();

    // 为每个未配对的选手寻找对手
    for (let i = 0; i < sortedPlayers.length; i++) {
      if (paired.has(sortedPlayers[i]._id.toString())) continue;

      let foundOpponent = false;
      for (let j = i + 1; j < sortedPlayers.length; j++) {
        if (paired.has(sortedPlayers[j]._id.toString())) continue;

        // 检查这两个选手是否已经对战过
        const hasPlayed = playerScores.get(sortedPlayers[i]._id.toString())?.opponents
          .some(oppId => oppId.toString() === sortedPlayers[j]._id.toString());

        if (!hasPlayed) {
          matches.push({
            player1: sortedPlayers[i]._id,
            player2: sortedPlayers[j]._id,
            winner: null,
            result: '',
            player1Score: playerScores.get(sortedPlayers[i]._id.toString())?.currentScore || 0,
            player2Score: playerScores.get(sortedPlayers[j]._id.toString())?.currentScore || 0
          });

          paired.add(sortedPlayers[i]._id.toString());
          paired.add(sortedPlayers[j]._id.toString());
          foundOpponent = true;
          break;
        }
      }

      // 如果没有找到合适的对手，尝试和已经对战过的选手配对
      if (!foundOpponent && !paired.has(sortedPlayers[i]._id.toString())) {
        for (let j = i + 1; j < sortedPlayers.length; j++) {
          if (paired.has(sortedPlayers[j]._id.toString())) continue;

          matches.push({
            player1: sortedPlayers[i]._id,
            player2: sortedPlayers[j]._id,
            winner: null,
            result: '',
            player1Score: playerScores.get(sortedPlayers[i]._id.toString())?.currentScore || 0,
            player2Score: playerScores.get(sortedPlayers[j]._id.toString())?.currentScore || 0
          });

          paired.add(sortedPlayers[i]._id.toString());
          paired.add(sortedPlayers[j]._id.toString());
          break;
        }
      }
    }

    // 处理剩余的未配对选手
    const unpaired = sortedPlayers.filter(p => !paired.has(p._id.toString()));
    if (unpaired.length === 1) {
      matches.push({
        player1: unpaired[0]._id,
        player2: unpaired[0]._id, // 自己对阵自己表示轮空
        winner: unpaired[0]._id, // 轮空自动获胜
        result: 'BYE',
        player1Score: playerScores.get(unpaired[0]._id.toString())?.currentScore || 0,
        player2Score: playerScores.get(unpaired[0]._id.toString())?.currentScore || 0
      });
    } else if (unpaired.length > 1) {
      for (let i = 0; i < unpaired.length - 1; i += 2) {
        matches.push({
          player1: unpaired[i]._id,
          player2: unpaired[i + 1]._id,
          winner: null,
          result: '',
          player1Score: playerScores.get(unpaired[i]._id.toString())?.currentScore || 0,
          player2Score: playerScores.get(unpaired[i + 1]._id.toString())?.currentScore || 0
        });
      }
      if (unpaired.length % 2 === 1) {
        const lastPlayer = unpaired[unpaired.length - 1];
        matches.push({
          player1: lastPlayer._id,
          player2: lastPlayer._id,
          winner: lastPlayer._id,
          result: 'BYE',
          player1Score: playerScores.get(lastPlayer._id.toString())?.currentScore || 0,
          player2Score: playerScores.get(lastPlayer._id.toString())?.currentScore || 0
        });
      }
    }

    // 更新 tournament 的 playerScores
    tournament.playerScores = Array.from(playerScores.entries()).map(([playerId, scoreData]) => ({
      player: new Types.ObjectId(playerId),
      currentScore: scoreData.currentScore, // 保留当前得分
      initialScore: scoreData.initialScore, // 保留初始分数
      wins: scoreData.wins,
      losses: scoreData.losses,
      draws: scoreData.draws,
      opponents: scoreData.opponents
    }));

    await tournament.save();

    // 创建新轮次
    const newRound = {
      roundNumber: currentRoundNumber,
      matches,
      completed: false
    };

    // 合并现有轮次和新轮次
    tournament.rounds = [...tournament.rounds, newRound];
    
    // 更新比赛状态和选手得分
    tournament.status = TournamentStatus.ONGOING;
    
    // 计算并更新每个选手的当前得分
    const updatedPlayerScores = new Map();
    tournament.rounds.forEach((round, roundIndex) => {
      round.matches.forEach(match => {
        if (match.winner) {
          const winnerScore = updatedPlayerScores.get(match.winner.toString());
          if (winnerScore) {
            winnerScore.currentScore += 2; // 胜者增加2分
            winnerScore.wins += 1;
            updatedPlayerScores.set(match.winner.toString(), winnerScore);
          }

          // 更新败者得分
          const loserId = match.player1.toString() === match.winner.toString() 
            ? match.player2.toString() 
            : match.player1.toString();
          const loserScore = updatedPlayerScores.get(loserId);
          if (loserScore) {
            loserScore.losses += 1;
            updatedPlayerScores.set(loserId, loserScore);
          }
        }
      });
    });

    // 将更新后的得分转换为数组格式
    tournament.playerScores = Array.from(updatedPlayerScores.entries()).map(([playerId, score]) => ({
      player: new Types.ObjectId(playerId),
      currentScore: score.currentScore,
      initialScore: 0,  // 设置为0，因为我们不再使用这个字段
      wins: score.wins,
      losses: score.losses,
      draws: score.draws,
      opponents: score.opponents || []
    }));

    console.log('Final player scores:', tournament.playerScores);

    // 保存更新
    const updatedTournament = await Tournament.findByIdAndUpdate(
      tournamentId,
      {
        $set: {
          rounds: tournament.rounds,
          status: tournament.status,
          playerScores: tournament.playerScores
        }
      },
      { new: true }
    ).populate('players').exec();

    return updatedTournament;
  }

  async updateTournamentResults(
    tournamentId: string,
    matchId: string,
    winnerId: string,
    result: string
  ): Promise<TournamentDocument | null> {
    const tournament = await Tournament.findById(tournamentId)
      .populate('players')
      .populate({
        path: 'rounds.matches.player1',
        select: 'name rank'
      })
      .populate({
        path: 'rounds.matches.player2',
        select: 'name rank'
      })
      .exec();

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Find the match in any round
    let targetMatch: any = null;
    let targetRound: any = null;
    
    tournament.rounds.forEach((round: any) => {
      const match = round.matches.find((m: any) => m._id.toString() === matchId);
      if (match) {
        targetMatch = match;
        targetRound = round;
      }
    });

    if (!targetMatch) {
      throw new Error('Match not found');
    }

    // 记录更新前的分数
    console.log('=== [后台] 更新结果前的分数 ===');
    console.log(`选手1 ${targetMatch.player1.name}: ${targetMatch.player1Score}分`);
    console.log(`选手2 ${targetMatch.player2.name}: ${targetMatch.player2Score}分`);
    console.log(`获胜者ID: ${winnerId}`);

    // Update the match result
    targetMatch.winner = winnerId;
    targetMatch.result = result;

    // Update player scores
    const winnerScore = targetMatch.player1._id.toString() === winnerId ? 
      targetMatch.player1Score + 2 : 
      targetMatch.player2Score + 2;

    if (targetMatch.player1._id.toString() === winnerId) {
      targetMatch.player1Score = winnerScore;
    } else {
      targetMatch.player2Score = winnerScore;
    }

    // Check if all matches in the round are complete
    const allMatchesComplete = targetRound.matches.every((match: any) => match.winner);
    if (allMatchesComplete) {
      targetRound.completed = true;
    }

    await tournament.save();

    // 记录更新后的分数
    console.log('=== [后台] 更新结果后的分数 ===');
    console.log(`选手1 ${targetMatch.player1.name}: ${targetMatch.player1Score}分`);
    console.log(`选手2 ${targetMatch.player2.name}: ${targetMatch.player2Score}分`);

    return tournament;
  }

  async getPlayerById(id: string): Promise<PlayerDocument | null> {
    return Player.findById<PlayerDocument>(id).exec();
  }

  private async updatePlayerStats(
    winner: PlayerDocument,
    loser: PlayerDocument,
    ratingChange: number
  ): Promise<void> {
    // Initialize ratings if they don't exist
    if (typeof winner.rating !== 'number') winner.rating = 1500;
    if (typeof loser.rating !== 'number') loser.rating = 1500;

    // Update winner stats
    winner.wins = (winner.wins || 0) + 1;
    winner.rating += ratingChange;
    await winner.save();

    // Update loser stats
    loser.losses = (loser.losses || 0) + 1;
    loser.rating -= ratingChange;
    await loser.save();
  }

  private calculateRatingChange(winner: PlayerDocument, loser: PlayerDocument): number {
    const K = 32; // Rating change factor
    const winnerRating = winner.rating || 1500;
    const loserRating = loser.rating || 1500;
    const expectedWinnerScore = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    return Math.round(K * (1 - expectedWinnerScore));
  }

  private async checkTournamentCompletion(tournament: TournamentDocument): Promise<boolean> {
    // 检查轮次数量
    if (tournament.rounds.length < 4) {
      console.log('Tournament not complete: Less than 4 rounds');
      return false;
    }

    // 检查当前轮次是否完成
    const currentRound = tournament.rounds[tournament.rounds.length - 1];
    if (!currentRound || !currentRound.completed) {
      console.log('Tournament not complete: Current round not completed');
      return false;
    }

    // 所有条件满足，比赛可以结束
    console.log('Tournament can be completed: All conditions met');
    return true;
  }

  private async getPlayerScore(tournamentId: string, playerId: string): Promise<number> {
    const tournament = await Tournament.findById(tournamentId)
      .populate('rounds.matches')
      .exec();

    if (!tournament) return 0;

    let score = 0;
    tournament.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.winner?.toString() === playerId) {
          score += 1;
        }
      });
    });
    return score;
  }

  private async havePlayed(tournamentId: string, player1Id: string, player2Id: string): Promise<boolean> {
    const tournament = await Tournament.findById(tournamentId)
      .populate('rounds.matches')
      .exec();

    if (!tournament) return false;

    return tournament.rounds.some(round =>
      round.matches.some(match =>
        (match.player1.toString() === player1Id && match.player2.toString() === player2Id) ||
        (match.player1.toString() === player2Id && match.player2.toString() === player1Id)
      )
    );
  }

  async generateSwissPairings(tournamentId: string): Promise<IMatch[]> {
    const tournament = await Tournament.findById(tournamentId)
      .populate('players')
      .populate({
        path: 'rounds.matches.player1',
        select: 'name rank'
      })
      .populate({
        path: 'rounds.matches.player2',
        select: 'name rank'
      })
      .exec();

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const scores = this.calculatePlayerScores(tournament);
    const playerScores = tournament.players.map((player: any) => ({
      player: player._id.toString(),
      name: player.name,
      score: this.getPlayerScore(scores, player._id.toString())
    })).sort((a, b) => b.score - a.score); // 按分数降序排序

    const matches: IMatch[] = [];
    const paired = new Set<string>();

    // 为每个未配对的选手寻找对手
    for (let i = 0; i < playerScores.length; i++) {
      const player1 = playerScores[i];
      if (paired.has(player1.player)) continue;

      let foundOpponent = false;
      let allowRematch = false;
      
      while (!foundOpponent) {
        for (let j = i + 1; j < playerScores.length; j++) {
          const player2 = playerScores[j];
          if (paired.has(player2.player)) continue;

          // 检查是否已经对战过
          const played = await this.havePlayed(tournamentId, player1.player, player2.player);

          if (!played || allowRematch) {
            foundOpponent = true;
            paired.add(player1.player);
            paired.add(player2.player);
            matches.push({
              player1: new Types.ObjectId(player1.player),
              player2: new Types.ObjectId(player2.player),
              winner: null,
              result: '',
              player1Score: playerScores.get(player1.player.toString())?.currentScore || 0,
              player2Score: playerScores.get(player2.player.toString())?.currentScore || 0
            });
            break;
          }
        }

        // 如果没有找到配对，允许重复对战
        if (!foundOpponent && !allowRematch) {
          allowRematch = true;
        } else {
          break;
        }
      }

      // 如果没有找到合适的对手，尝试和已经对战过的选手配对
      if (!foundOpponent && !paired.has(player1.player)) {
        for (let j = i + 1; j < playerScores.length; j++) {
          const player2 = playerScores[j];
          if (paired.has(player2.player)) continue;

          paired.add(player1.player);
          paired.add(player2.player);
          matches.push({
            player1: new Types.ObjectId(player1.player),
            player2: new Types.ObjectId(player2.player),
            winner: null,
            result: '',
            player1Score: playerScores.get(player1.player.toString())?.currentScore || 0,
            player2Score: playerScores.get(player2.player.toString())?.currentScore || 0
          });
          break;
        }
      }
    }

    // 处理剩余未配对的选手
    const unpaired = playerScores.filter(p => !paired.has(p.player));
    if (unpaired.length === 1) {
      // 如果只有一名选手未配对，给予轮空
      matches.push({
        player1: new Types.ObjectId(unpaired[0].player),
        player2: new Types.ObjectId(unpaired[0].player), // 自己对阵自己表示轮空
        winner: new Types.ObjectId(unpaired[0].player), // 轮空自动获胜
        result: 'BYE',
        player1Score: playerScores.get(unpaired[0].player.toString())?.currentScore || 0,
        player2Score: playerScores.get(unpaired[0].player.toString())?.currentScore || 0
      });
    } else if (unpaired.length > 1) {
      for (let i = 0; i < unpaired.length - 1; i += 2) {
        matches.push({
          player1: new Types.ObjectId(unpaired[i].player),
          player2: new Types.ObjectId(unpaired[i + 1].player),
          winner: null,
          result: '',
          player1Score: playerScores.get(unpaired[i].player.toString())?.currentScore || 0,
          player2Score: playerScores.get(unpaired[i + 1].player.toString())?.currentScore || 0
        });
      }
      if (unpaired.length % 2 === 1) {
        const lastPlayer = unpaired[unpaired.length - 1];
        matches.push({
          player1: new Types.ObjectId(lastPlayer.player),
          player2: new Types.ObjectId(lastPlayer.player),
          winner: new Types.ObjectId(lastPlayer.player),
          result: 'BYE',
          player1Score: playerScores.get(lastPlayer.player.toString())?.currentScore || 0,
          player2Score: playerScores.get(lastPlayer.player.toString())?.currentScore || 0
        });
      }
    }

    return matches;
  }

  async createNextRound(tournament: ITournament): Promise<IRound[]> {
    let matches: IMatch[] = [];

    if (tournament.format === TournamentFormat.MCMAHON) {
      // 累积 currentScore 为上一轮比赛前的 currentScore 加上上一轮的得分
      tournament.playerScores.forEach(score => {
        const previousRoundScore = score.currentScore - score.initialScore;
        score.currentScore += previousRoundScore;
      });
    }

    if (tournament.format === TournamentFormat.SWISS) {
      matches = await this.generateSwissPairings(tournament._id!.toString());
    } else if (tournament.format === TournamentFormat.ROUNDROBIN) {
      matches = this.generateRoundRobinPairings(tournament);
    } else {
      matches = this.generateEliminationPairings(tournament);
    }

    const newRound: IRound = {
      roundNumber: tournament.rounds.length + 1,
      matches,
      completed: false
    };

    tournament.rounds.push(newRound);
    // 返回更新后的 tournament，让 controller 来处理保存
    return tournament.rounds;
  }

  // 计算选手得分
  calculatePlayerScores(tournament: any): Map<string, { score: number, opponentScore: number }> {
    const scores = new Map<string, { score: number, opponentScore: number }>();
    
    // 初始化所有选手得分为初始分数
    tournament.playerScores.forEach((playerScore: any) => {
      scores.set(playerScore.player.toString(), {
        score: playerScore.currentScore, // 使用当前分数作为基础
        opponentScore: 0
      });
    });

    // 遍历所有轮次和比赛，计算得分
    tournament.rounds.forEach((round: any) => {
      round.matches.forEach((match: any) => {
        if (match.winner) {
          const winnerId = match.winner._id.toString();
          const loserId = match.player1._id.toString() === winnerId 
            ? match.player2._id.toString() 
            : match.player1._id.toString();

          // 获胜者得2分
          const winnerScore = scores.get(winnerId) || { score: 0, opponentScore: 0 };
          scores.set(winnerId, {
            score: winnerScore.score + 2,
            opponentScore: winnerScore.opponentScore
          });

          // 失败者得0分
          if (match.result !== 'BYE') {
            const loserScore = scores.get(loserId) || { score: 0, opponentScore: 0 };
            scores.set(loserId, {
              score: loserScore.score,
              opponentScore: loserScore.opponentScore
            });
          }
        }
      });
    });

    // 计算对手分
    tournament.rounds.forEach((round: any) => {
      round.matches.forEach((match: any) => {
        if (match.winner && match.result !== 'BYE') {
          const player1Id = match.player1._id.toString();
          const player2Id = match.player2._id.toString();
          
          // 更新双方的对手分
          const player1Score = scores.get(player1Id);
          const player2Score = scores.get(player2Id);
          
          if (player1Score && player2Score) {
            scores.set(player1Id, {
              ...player1Score,
              opponentScore: player1Score.opponentScore + player2Score.score
            });
            
            scores.set(player2Id, {
              ...player2Score,
              opponentScore: player2Score.opponentScore + player1Score.score
            });
          }
        }
      });
    });

    return scores;
  }

  // 获取选手的当前得分
  getPlayerScore(scores: Map<string, { score: number, opponentScore: number }>, playerId: string): { score: number, opponentScore: number } {
    return scores.get(playerId.toString()) || { score: 0, opponentScore: 0 };
  }

  // 查找两个选手之间的直接对局结果
  findHeadToHeadResult(tournament: any, player1Id: string, player2Id: string): string | null {
    for (const round of tournament.rounds) {
      for (const match of round.matches) {
        // 检查是否是这两个选手的比赛
        if ((match.player1._id.toString() === player1Id && match.player2._id.toString() === player2Id) ||
            (match.player1._id.toString() === player2Id && match.player2._id.toString() === player1Id)) {
          if (match.winner) {
            return match.winner._id.toString();
          }
        }
      }
    }
    return null;
  }

  // 获取排序后的选手列表
  getSortedPlayers(tournament: any): { player: any, score: number, opponentScore: number, totalScore: number }[] {
    const scores = this.calculatePlayerScores(tournament);
    
    // 找出最高积分
    let maxScore = 0;
    scores.forEach(({ score }) => {
      if (score > maxScore) {
        maxScore = score;
      }
    });

    // 计算轮次数
    const roundCount = tournament.rounds.length;
    
    const playersWithScores = tournament.players.map((player: any) => {
      const { score, opponentScore } = this.getPlayerScore(scores, player._id.toString());
      // 总得分＝个人积分＋｛[对手积分总和÷（最高积分／2）]－轮次数｝
      const totalScore = score + ((opponentScore / (maxScore / 2)) - roundCount);
      
      return {
        player,
        score,
        opponentScore,
        totalScore
      };
    });

    // 排序：先按总分，总分相同时按直接对局结果
    return playersWithScores.sort((a, b) => {
      // 如果总分不同，按总分排序
      if (Math.abs(b.totalScore - a.totalScore) > 0.001) { // 使用小数点比较
        return b.totalScore - a.totalScore;
      }
      
      // 如果总分相同，查找直接对局结果
      const headToHeadWinner = this.findHeadToHeadResult(tournament, 
        a.player._id.toString(), 
        b.player._id.toString()
      );
      
      if (headToHeadWinner) {
        // 如果 b 是直接对局的胜者，b 排在前面
        if (headToHeadWinner === b.player._id.toString()) {
          return 1;
        }
        // 如果 a 是直接对局的胜者，a 排在前面
        if (headToHeadWinner === a.player._id.toString()) {
          return -1;
        }
      }
      
      // 如果没有直接对局结果，保持原有顺序
      return 0;
    });
  }

  // 设置选手初始分数
  private async setInitialScores(tournament: TournamentDocument): Promise<void> {
    const players = await Player.find({ _id: { $in: tournament.players } });
    tournament.playerScores = players.map(player => {
      // 解析段位
      const rank = player.rank.toLowerCase();
      const isD = rank.includes('d');
      const isK = rank.includes('k');
      const level = parseInt(rank);
      
      let initialScore = 0;
      // 5D以上，起始分6分
      if (isD && level >= 5) {
        initialScore = 6;
      }
      // 1-4D，起始分0分
      else if (isD && level >= 1 && level <= 4) {
        initialScore = 0;
      }
      // 1-5K，起始分-6分
      else if (isK && level >= 1 && level <= 5) {
        initialScore = -6;
      }
      // 6K以下，起始分-12分
      else if (isK && level >= 6) {
        initialScore = -12;
      }

      return {
        player: player._id,
        currentScore: initialScore,
        initialScore: initialScore,
        wins: 0,
        losses: 0,
        draws: 0,
        opponents: []
      };
    });

    await tournament.save();
  }
}
