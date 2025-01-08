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
import { MongoId, toString } from '../types/mongoose.types';

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

  // Generate pairings for the next round
  async generatePairings(tournamentId: string): Promise<TournamentDocument | null> {
    console.log('Generating next round for tournament:', tournamentId);
    
    // Get tournament with all necessary data populated
    const tournament = await Tournament.findById(tournamentId)
      .populate<{ players: PlayerDocument[] }>('players')
      .exec() as PopulatedTournament | null;

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    console.log('Tournament format 赛制:', tournament.format);
    
    // 如果是第一轮 McMahon 赛制，设置初始分数
    if (tournament.format === TournamentFormat.MCMAHON && tournament.rounds.length === 0) {
      await this.setInitialMcMahonScores(tournament);
    }

    // 计算当前轮次编号
    const currentRoundNumber = tournament.rounds.length > 0 
      ? Math.max(...tournament.rounds.map(r => r.roundNumber)) + 1 
      : 1;

    // 根据赛制生成对局
    let matches: IMatch[];
    switch (tournament.format) {
      case TournamentFormat.MCMAHON:
        matches = await this.generateMcMahonPairings(tournament);
        break;
      case TournamentFormat.SWISS:
        matches = await this.generateSwissPairings(tournament);
        break;
      case TournamentFormat.ROUNDROBIN:
        matches = await this.generateRoundRobinPairings(tournament);
        break;
      default:
        throw new Error(`Unsupported tournament format: ${tournament.format}`);
    }

    // 获取所有选手的名字映射
    const playerNames = new Map(
      tournament.players.map((player: any) => [player._id.toString(), player.name])
    );

    console.log('第', currentRoundNumber, '轮对阵:', {
      roundNumber: currentRoundNumber,
      matches: matches.map(match => ({
        player1: playerNames.get(match.player1.toString()),
        player2: playerNames.get(match.player2.toString()),
        winner: match.winner ? playerNames.get(match.winner.toString()) : null,
        result: match.result,
        player1Score: match.player1Score,
        player2Score: match.player2Score
      })),
      completed: false
    });

    // 创建新轮次
    const newRound = {
      roundNumber: currentRoundNumber,
      matches,
      completed: false
    };

    // 更新比赛
    tournament.rounds.push(newRound);
    tournament.status = TournamentStatus.ONGOING;

    // 保存更新
    await tournament.save();
    
    return tournament;
  }

  async updateTournamentResults(
    tournamentId: string,
    matchId: string,
    winnerId: string,
    result: string
  ): Promise<TournamentDocument | null> {
    console.log('开始更新比赛结果的，调用方法updateTournamentResults:', { tournamentId, matchId, winnerId, result });
    const tournament = await Tournament.findById(tournamentId)
      .populate('players')
      .exec();
      
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const round = tournament.rounds.find(r =>
      r.matches.some(m => m._id && toString(m._id) === matchId)
    );

    if (!round) {
      throw new Error('Match not found');
    }

    const match = round.matches.find(m => m._id && toString(m._id) === matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    // 获取所有选手的名字映射
    const playerNames = new Map(
      tournament.players.map((player: any) => [player._id.toString(), player.name])
    );

    console.log('当前轮次:', {
      roundNumber: round.roundNumber,
      matches: round.matches.map(match => ({
        player1: playerNames.get(match.player1.toString()),
        player2: playerNames.get(match.player2.toString()),
        winner: match.winner ? playerNames.get(match.winner.toString()) : null,
        result: match.result,
        player1Score: match.player1Score,
        player2Score: match.player2Score
      }))
    });

    // 更新比赛结果
    match.winner = new Types.ObjectId(winnerId);  // 直接使用Types.ObjectId
    match.result = result;

    // 更新选手得分
    const playerScores = new Map(
      tournament.playerScores?.map(score => [score.player.toString(), score]) || []
    );
    
    const winner = playerScores.get(winnerId);
    const loser = playerScores.get(
      match.player1.toString() === winnerId 
        ? match.player2.toString() 
        : match.player1.toString()
    );

    // 获取选手名字
    const winnerPlayer = tournament.players.find((p: any) => p._id.toString() === winnerId);
    const loserPlayer = tournament.players.find((p: any) => 
      p._id.toString() === (match.player1.toString() === winnerId ? match.player2.toString() : match.player1.toString())
    );

    console.log('更新得分前:', {
      winner: winner ? { 
        name: winnerPlayer?.name,
        currentScore: winner.currentScore 
      } : null,
      loser: loser ? { 
        name: loserPlayer?.name,
        currentScore: loser.currentScore 
      } : null
    });

    if (winner) {
      winner.currentScore += 2;  // McMahon 赛制胜者得2分
      console.log('有人得分增加了:', {
        winner: winner ? { 
          name: winnerPlayer?.name,
          currentScore: winner.currentScore 
        } : null,
      });
      winner.wins += 1;
      // 记录对手
      if (!winner.opponents) winner.opponents = [];
      winner.opponents.push(match.player1.toString() === winnerId ? match.player2 : match.player1);
    }
    if (loser) {
      loser.losses += 1;
      // 记录对手
      if (!loser.opponents) loser.opponents = [];
      loser.opponents.push(match.player1.toString() === winnerId ? match.player1 : match.player2);
    }

    console.log('更新得分后:', {
      winner: winner ? { 
        name: winnerPlayer?.name,
        currentScore: winner.currentScore 
      } : null,
      loser: loser ? { 
        name: loserPlayer?.name,
        currentScore: loser.currentScore 
      } : null
    });

    tournament.playerScores = Array.from(playerScores.values());

    // 检查当前轮次是否完成
    const isRoundComplete = round.matches.every(m => m.winner != null);
    if (isRoundComplete) {
      round.completed = true;
    }

    console.log('保存前确认winner:', {
      tournamentId,
      matchId,
      winner: match.winner,
      winnerType: typeof match.winner,
      isObjectId: match.winner instanceof Types.ObjectId
    });

    // 直接保存整个tournament对象
    await tournament.save();

    // 重新获取更新后的tournament
    const updatedTournament = await Tournament.findById(tournamentId)
      .populate('players')
      .exec();

    console.log('保存后确认winner:', {
      tournamentId,
      matchId,
      winner: updatedTournament?.rounds
        .find(r => r.matches.some(m => m._id.toString() === matchId))
        ?.matches.find(m => m._id.toString() === matchId)?.winner,
    });

    return updatedTournament;
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
      // 如果有多个未配对的选手，强制配对
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
      
      // 如果还有一个落单的选手，给予轮空
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
    
    // 初始化选手得分为其初始分数
    tournament.playerScores.forEach((playerScore: any) => {
      scores.set(playerScore.player.toString(), { 
        score: playerScore.initialScore || 0,  // 使用初始分数，如果没有则为0
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
    // 直接使用playerScores中的数据
    const playersWithScores = tournament.playerScores.map((playerScore: any) => {
      const player = tournament.players.find((p: any) => p._id.toString() === playerScore.player.toString());
      
      // 总得分＝当前分数＋｛[对手积分总和÷（最高分／2）]－轮次数｝
      // 确保所有数值都有默认值，防止null
      const currentScore = playerScore.currentScore || 0;
      const opponentScore = playerScore.opponentScore || 0;
      const upperBar = tournament.upperBar || 8;  // 如果没有设置upperBar，默认使用8
      const roundCount = tournament.rounds ? tournament.rounds.length : 0;
      
      const totalScore = currentScore + ((opponentScore / (upperBar / 2)) - roundCount);
      
      return {
        player,
        score: currentScore,
        opponentScore,
        totalScore: Number(totalScore.toFixed(2))  // 确保返回数字而不是字符串
      };
    });

    // 排序：先按总分，总分相同时按直接对局结果
    return playersWithScores.sort((a, b) => {
      // 如果总分不同，按总分排序
      if (Math.abs(b.totalScore - a.totalScore) > 0.001) {
        return b.totalScore - a.totalScore;
      }
      
      // 如果总分相同，查找直接对局结果
      const headToHeadWinner = this.findHeadToHeadResult(tournament, 
        a.player._id.toString(), 
        b.player._id.toString()
      );
      
      if (headToHeadWinner === a.player._id.toString()) {
        return -1;  // a 排在前面
      } else if (headToHeadWinner === b.player._id.toString()) {
        return 1;   // b 排在前面
      }
      
      // 如果没有直接对局或者是平局，保持原有顺序
      return 0;
    });
  }

  private async setInitialMcMahonScores(tournament: PopulatedTournament): Promise<void> {
    console.log("现在调用setInitialMcMahonScores");
    
    if (tournament.format !== TournamentFormat.MCMAHON) {
      return;
    }

    // Reset playerScores array
    tournament.playerScores = [];
    console.log("清空了playerScores数组");

    for (const player of tournament.players) {
      const rank = player.rank;
      let initialScore = 0;
      console.log(`处理选手: ${player.name}, 段位: ${rank}`);

      // Extract rank number and type (match both upper and lower case d/k)
      const rankMatch = rank.match(/(\d+)([dDkK])/);
      if (rankMatch) {
        const [_, number, type] = rankMatch;
        const rankNum = parseInt(number);
        const upperType = type.toUpperCase();
        console.log(`解析段位: 数字=${rankNum}, 类型=${upperType}`);

        if (upperType === 'D') {
          if (rankNum >= 5) {
            initialScore = 6;  // 5D and above
            console.log(`5D以上, 设置初始分为: ${initialScore}`);
          } else {
            initialScore = 0;  // 1D-4D
            console.log(`1D-4D, 设置初始分为: ${initialScore}`);
          }
        } else if (upperType === 'K') {
          if (rankNum <= 5) {
            initialScore = -6;  // 1K-5K
            console.log(`1K-5K, 设置初始分为: ${initialScore}`);
          } else {
            initialScore = -12;  // 6K and below
            console.log(`6K以下, 设置初始分为: ${initialScore}`);
          }
        }
      } else {
        console.log(`警告: 无法解析段位 ${rank}, 使用默认分数 0`);
      }

      tournament.playerScores.push({
        player: player._id,
        currentScore: initialScore,
        initialScore: initialScore,
        wins: 0,
        losses: 0,
        draws: 0,
        opponents: []
      });
      console.log(`已添加选手 ${player.name} 的分数记录: 初始分=${initialScore}`);
    }

    console.log("所有选手的分数设置完成，准备保存");
    console.log("最终的playerScores:", tournament.playerScores);
    await tournament.save();
    console.log("分数保存完成");
  }

  private async generateMcMahonPairings(tournament: PopulatedTournament): Promise<IMatch[]> {
    // 获取所有选手的当前分数和对手历史
    const playerScores = new Map(tournament.playerScores.map(score => [
      score.player.toString(),
      {
        currentScore: score.currentScore,
        opponents: score.opponents || []
      }
    ]));

    // 根据当前分数对选手进行排序
    const sortedPlayers = [...tournament.players].sort((a, b) => {
      const scoreA = playerScores.get(a._id.toString())?.currentScore || 0;
      const scoreB = playerScores.get(b._id.toString())?.currentScore || 0;
      return scoreB - scoreA;  // 按分数降序排序
    });

    // 获取已经进行的对局历史
    const playedMatches = new Map<string, Set<string>>();
    tournament.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.winner) {  // 只考虑已经完成的对局
          const player1Id = match.player1.toString();
          const player2Id = match.player2.toString();
          
          // 为player1添加对手
          if (!playedMatches.has(player1Id)) {
            playedMatches.set(player1Id, new Set<string>());
          }
          playedMatches.get(player1Id)!.add(player2Id);
          
          // 为player2添加对手
          if (!playedMatches.has(player2Id)) {
            playedMatches.set(player2Id, new Set<string>());
          }
          playedMatches.get(player2Id)!.add(player1Id);
        }
      });
    });

    console.log("已对阵历史:", Array.from(playedMatches.entries()).map(([id, opponents]) => {
      const player = tournament.players.find(p => p._id.toString() === id);
      return `${player?.name}: ${Array.from(opponents).map(oppId => 
        tournament.players.find(p => p._id.toString() === oppId)?.name
      ).join(', ')}`;
    }));

    const matches: IMatch[] = [];
    const used = new Set<string>();

    // 生成对局
    for (let i = 0; i < sortedPlayers.length && used.size < sortedPlayers.length - 1; i++) {
      const player1 = sortedPlayers[i];
      if (used.has(player1._id.toString())) {
        console.log(`跳过 ${player1.name} - 已经被配对`);
        continue;
      }

      console.log(`\n为 ${player1.name} 寻找对手...`);
      const player1Id = player1._id.toString();
      const player1Opponents = playedMatches.get(player1Id) || new Set<string>();

      // 寻找最近的未配对且未对战过的选手
      for (let j = i + 1; j < sortedPlayers.length; j++) {
        const player2 = sortedPlayers[j];
        const player2Id = player2._id.toString();
        
        if (used.has(player2Id)) {
          console.log(`  跳过 ${player2.name} - 已经被配对`);
          continue;
        }

        // 检查是否已经对战过
        const hasPlayed = player1Opponents.has(player2Id);
        console.log(`  检查 ${player2.name} - ${hasPlayed ? '已对阵过' : '未对阵过'}`);

        if (!hasPlayed) {  // 如果还没有对战过
          console.log(`  配对成功: ${player1.name} vs ${player2.name}`);
          matches.push({
            player1: player1._id,
            player2: player2._id,
            winner: null,
            result: '',
            player1Score: playerScores.get(player1Id)?.currentScore || 0,
            player2Score: playerScores.get(player2Id)?.currentScore || 0
          });

          used.add(player1Id);
          used.add(player2Id);
          break;
        }
      }

      // 如果没有找到未对战过的选手，则与最近的未配对选手配对
      if (!used.has(player1Id)) {
        console.log(`  ${player1.name} 没有找到未对战过的选手，尝试强制配对`);
        for (let j = i + 1; j < sortedPlayers.length; j++) {
          const player2 = sortedPlayers[j];
          const player2Id = player2._id.toString();
          
          if (!used.has(player2Id)) {
            console.log(`  强制配对: ${player1.name} vs ${player2.name}`);
            matches.push({
              player1: player1._id,
              player2: player2._id,
              winner: null,
              result: '',
              player1Score: playerScores.get(player1Id)?.currentScore || 0,
              player2Score: playerScores.get(player2Id)?.currentScore || 0
            });

            used.add(player1Id);
            used.add(player2Id);
            break;
          }
        }
      }
    }

    // 处理轮空选手
    const remainingPlayer = sortedPlayers.find(p => !used.has(p._id.toString()));
    if (remainingPlayer) {
      matches.push({
        player1: remainingPlayer._id,
        player2: remainingPlayer._id,  // 自己对阵自己表示轮空
        winner: remainingPlayer._id,   // 轮空自动获胜
        result: 'BYE',
        player1Score: playerScores.get(remainingPlayer._id.toString())?.currentScore || 0,
        player2Score: playerScores.get(remainingPlayer._id.toString())?.currentScore || 0
      });

      // 轮空选手自动获胜，得1分
      const score = playerScores.get(remainingPlayer._id.toString());
      if (score) {
        score.currentScore += 1;
      }
    }

    return matches;
  }

  private async generateSwissPairings(tournament: PopulatedTournament): Promise<IMatch[]> {
    throw new Error('Swiss pairing not implemented');
  }

  private async generateRoundRobinPairings(tournament: PopulatedTournament): Promise<IMatch[]> {
    throw new Error('Round robin pairing not implemented');
  }
}
