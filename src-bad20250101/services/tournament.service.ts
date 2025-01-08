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

enum TournamentStatus {
  UPCOMING = 'UPCOMING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED'
}

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
    // 对于 McMahon 赛制，确保所有必要字段都存在
    if (tournamentData.format === TournamentFormat.MCMAHON) {
      const { upperBar, initialScore, minimumScore, roundCount } = tournamentData;
      if (upperBar === undefined || initialScore === undefined || minimumScore === undefined || roundCount === undefined) {
        throw new Error('McMahon tournament requires: upperBar, initialScore, minimumScore, roundCount');
      }

      // 确保分数设置合理
      if (minimumScore > initialScore) {
        throw new Error('Minimum score cannot be greater than initial score');
      }

      // 确保轮数合理
      if (roundCount < 1) {
        throw new Error('Round count must be at least 1');
      }

      // 初始化 playerScores 数组
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

  async generateNextRound(tournamentId: string): Promise<TournamentDocument | null> {
    const tournament = await Tournament.findById(tournamentId)
      .populate<{ players: PlayerDocument[] }>('players')
      .exec();

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (!tournament.players || tournament.players.length < 2) {
      throw new Error('Tournament needs at least 2 players');
    }

    // 确保 rounds 数组已初始化
    if (!tournament.rounds) {
      tournament.rounds = [];
    }

    // 更新比赛状态为进行中
    tournament.status = TournamentStatus.ONGOING;
    await tournament.save();

    // 初始化玩家得分
    if (!tournament.playerScores) {
      tournament.playerScores = tournament.players.map(player => ({
        player: player._id,
        currentScore: 0,
        initialScore: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        opponents: []
      }));
      await tournament.save();
    }

    // 将玩家得分转换为Map以便快速查找
    const playerScores = new Map(
      tournament.playerScores.map(score => [score.player.toString(), score])
    );

    // 按当前得分和段位排序
    const sortedPlayers = tournament.players.sort((a, b) => {
      const scoreA = playerScores.get(a._id.toString())?.currentScore || 0;
      const scoreB = playerScores.get(b._id.toString())?.currentScore || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      const rankA = parseInt(a.rank.replace(/[^0-9]/g, '')) || 0;
      const rankB = parseInt(b.rank.replace(/[^0-9]/g, '')) || 0;
      return rankB - rankA;
    });

    // 按分数分组
    const scoreGroups = new Map<number, PlayerDocument[]>();
    sortedPlayers.forEach(player => {
      const score = playerScores.get(player._id.toString())?.currentScore || 0;
      if (!scoreGroups.has(score)) {
        scoreGroups.set(score, []);
      }
      scoreGroups.get(score)?.push(player);
    });

    const matches: IMatch[] = [];
    const paired = new Set<string>();

    // 从高分组开始配对
    const scores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);
    for (const score of scores) {
      const group = scoreGroups.get(score) || [];
      let remainingPlayers = group.filter(p => !paired.has(p._id.toString()));

      // 如果当前分组剩余奇数人，尝试从下一个分组借一个人
      if (remainingPlayers.length % 2 === 1 && scores.indexOf(score) < scores.length - 1) {
        const nextScore = scores[scores.indexOf(score) + 1];
        const nextGroup = scoreGroups.get(nextScore) || [];
        const upfloatCandidate = nextGroup.find(p => !paired.has(p._id.toString()));
        if (upfloatCandidate) {
          remainingPlayers.push(upfloatCandidate);
        }
      }

      // 在当前分组内配对
      while (remainingPlayers.length >= 2) {
        const player1 = remainingPlayers[0];
        let player2Index = 1;

        // 尝试找到一个合适的对手（未对战过）
        while (player2Index < remainingPlayers.length) {
          const player2 = remainingPlayers[player2Index];
          const hasPlayed = playerScores.get(player1._id.toString())?.opponents
            .some(oppId => oppId.toString() === player2._id.toString());

          if (!hasPlayed) {
            matches.push({
              player1: player1._id,
              player2: player2._id,
              winner: null,
              result: '',
              player1Score: playerScores.get(player1._id.toString())?.currentScore || 0,
              player2Score: playerScores.get(player2._id.toString())?.currentScore || 0
            });

            paired.add(player1._id.toString());
            paired.add(player2._id.toString());

            // 从剩余玩家列表中移除这两个玩家
            remainingPlayers = remainingPlayers.filter(p => 
              p._id.toString() !== player1._id.toString() && 
              p._id.toString() !== player2._id.toString()
            );
            break;
          }
          player2Index++;
        }

        // 如果没有找到未对战过的对手，就选择第一个可用的对手
        if (player2Index >= remainingPlayers.length && remainingPlayers.length >= 2) {
          const player2 = remainingPlayers[1];
          matches.push({
            player1: player1._id,
            player2: player2._id,
            winner: null,
            result: '',
            player1Score: playerScores.get(player1._id.toString())?.currentScore || 0,
            player2Score: playerScores.get(player2._id.toString())?.currentScore || 0
          });

          paired.add(player1._id.toString());
          paired.add(player2._id.toString());

          // 从剩余玩家列表中移除这两个玩家
          remainingPlayers = remainingPlayers.filter(p => 
            p._id.toString() !== player1._id.toString() && 
            p._id.toString() !== player2._id.toString()
          );
        }
      }
    }

    // 处理未配对的选手
    const unpaired = sortedPlayers.filter(p => !paired.has(p._id.toString()));
    if (unpaired.length === 1) {
      // 如果只剩一个选手，给他轮空并加一分
      const player = unpaired[0];
      const playerScore = playerScores.get(player._id.toString());
      if (playerScore) {
        playerScore.currentScore += 1;
        playerScore.wins += 1;
      }
    }

    // 创建新轮次
    const roundNumber = tournament.rounds.length + 1;
    tournament.rounds.push({
      roundNumber,
      matches,
      completed: false
    });

    return await tournament.save();
  }

  async updateTournamentResults(
    tournamentId: string,
    matchId: string,
    winnerId: string,
    result: string
  ): Promise<TournamentDocument | null> {
    const tournament = await Tournament.findById(tournamentId).exec();
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // 找到对应的比赛
    let targetMatch: IMatch | null = null;
    let currentRound: IRound | null = null;
    for (const round of tournament.rounds) {
      const match = round.matches.find(m => m._id.toString() === matchId);
      if (match) {
        targetMatch = match;
        currentRound = round;
        break;
      }
    }

    if (!targetMatch || !currentRound) {
      throw new Error('Match not found');
    }

    // 更新比赛结果
    targetMatch.winner = new Types.ObjectId(winnerId);
    targetMatch.result = result;

    // 获取或初始化 playerScores
    let playerScores = tournament.playerScores || [];
    
    // 更新选手得分
    const player1Id = targetMatch.player1.toString();
    const player2Id = targetMatch.player2.toString();
    const currentWinnerId = targetMatch.winner.toString();

    // 找到或创建选手的得分记录
    let player1Score = playerScores.find(ps => ps.player.toString() === player1Id);
    let player2Score = playerScores.find(ps => ps.player.toString() === player2Id);

    if (!player1Score) {
      player1Score = {
        player: targetMatch.player1,
        currentScore: 0,
        initialScore: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        opponents: []
      };
      playerScores.push(player1Score);
    }

    if (!player2Score) {
      player2Score = {
        player: targetMatch.player2,
        currentScore: 0,
        initialScore: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        opponents: []
      };
      playerScores.push(player2Score);
    }

    // 更新胜负记录和得分
    if (result === 'draw') {
      player1Score.draws += 1;
      player2Score.draws += 1;
      player1Score.currentScore += 0.5;
      player2Score.currentScore += 0.5;
    } else {
      if (player1Id === currentWinnerId) {
        player1Score.wins += 1;
        player2Score.losses += 1;
        player1Score.currentScore += 1;
      } else {
        player2Score.wins += 1;
        player1Score.losses += 1;
        player2Score.currentScore += 1;
      }
    }

    // 更新对手记录
    if (!player1Score.opponents) player1Score.opponents = [];
    if (!player2Score.opponents) player2Score.opponents = [];
    player1Score.opponents.push(targetMatch.player2);
    player2Score.opponents.push(targetMatch.player1);

    // 检查当前轮次是否完成
    const allMatchesCompleted = currentRound.matches.every(m => m.winner || m.result === 'draw');
    if (allMatchesCompleted) {
      currentRound.completed = true;
    }

    // 保存更新
    return await Tournament.findByIdAndUpdate(
      tournamentId,
      {
        $set: {
          rounds: tournament.rounds,
          playerScores: playerScores
        }
      },
      { new: true }
    ).exec();
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
    switch (tournament.format) {
      case TournamentFormat.ROUNDROBIN:
        return tournament.rounds.every(round => round.completed);
        
      case TournamentFormat.SINGLEELIMINATION:
        const finalRound = tournament.rounds[tournament.rounds.length - 1];
        return finalRound && finalRound.completed;
        
      case TournamentFormat.DOUBLEELIMINATION:
        const finalRounds = tournament.rounds.slice(-2);
        return finalRounds.every(round => round.completed);
        
      case TournamentFormat.SWISS:
        return tournament.rounds.length >= 4; // Assuming 4 rounds for Swiss format
        
      default:
        return false;
    }
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
              result: ''
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
            result: ''
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
        result: 'BYE'
      });
    } else if (unpaired.length > 1) {
      // 如果有多个未配对的选手，强制配对
      for (let i = 0; i < unpaired.length - 1; i += 2) {
        matches.push({
          player1: new Types.ObjectId(unpaired[i].player),
          player2: new Types.ObjectId(unpaired[i + 1].player),
          winner: null,
          result: ''
        });
      }
      
      // 如果还有一个落单的选手，给予轮空
      if (unpaired.length % 2 === 1) {
        const lastPlayer = unpaired[unpaired.length - 1];
        matches.push({
          player1: new Types.ObjectId(lastPlayer.player),
          player2: new Types.ObjectId(lastPlayer.player),
          winner: new Types.ObjectId(lastPlayer.player),
          result: 'BYE'
        });
      }
    }

    return matches;
  }

  async createNextRound(tournament: ITournament): Promise<IRound[]> {
    let matches: IMatch[] = [];

    if (tournament.format === TournamentFormat.SWISS) {
      matches = await this.generateSwissPairings(tournament._id!.toString());
    } else if (tournament.format === TournamentFormat.ROUNDROBIN) {
      // 现有的轮循环逻辑
      matches = this.generateRoundRobinPairings(tournament);
    } else {
      // 现有的淘汰赛逻辑
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
    
    // 初始化所有选手得分为0
    tournament.players.forEach((player: any) => {
      scores.set(player._id.toString(), { score: 0, opponentScore: 0 });
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

  async deleteRound(tournamentId: string, roundNumber: number): Promise<TournamentDocument | null> {
    const tournament = await Tournament.findById(tournamentId).exec();
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // 删除指定轮次
    tournament.rounds = tournament.rounds.filter(round => round.roundNumber !== roundNumber);
    
    // 重新编号剩余轮次
    tournament.rounds.sort((a, b) => a.roundNumber - b.roundNumber);
    tournament.rounds.forEach((round, index) => {
      round.roundNumber = index + 1;
    });

    // 重置玩家得分和对手记录
    if (tournament.playerScores) {
      tournament.playerScores = tournament.playerScores.map(score => ({
        ...score,
        currentScore: score.initialScore,
        wins: 0,
        losses: 0,
        draws: 0,
        opponents: []
      }));
    }

    // 重新计算所有轮次的得分
    for (const round of tournament.rounds) {
      for (const match of round.matches) {
        if (match.winner) {
          const winnerScore = tournament.playerScores?.find(
            score => score.player.toString() === match.winner?.toString()
          );
          const loserId = match.player1.toString() === match.winner.toString() 
            ? match.player2 
            : match.player1;
          const loserScore = tournament.playerScores?.find(
            score => score.player.toString() === loserId.toString()
          );

          if (winnerScore) {
            winnerScore.currentScore += 1;
            winnerScore.wins += 1;
          }
          if (loserScore) {
            loserScore.losses += 1;
            loserScore.opponents.push(match.winner);
          }
        } else if (match.result === 'draw') {
          const player1Score = tournament.playerScores?.find(
            score => score.player.toString() === match.player1.toString()
          );
          const player2Score = tournament.playerScores?.find(
            score => score.player.toString() === match.player2.toString()
          );

          if (player1Score) {
            player1Score.currentScore += 0.5;
            player1Score.draws += 1;
            player1Score.opponents.push(match.player2);
          }
          if (player2Score) {
            player2Score.currentScore += 0.5;
            player2Score.draws += 1;
            player2Score.opponents.push(match.player1);
          }
        }
      }
    }

    return await tournament.save();
  }
}
