import { Types, Document } from 'mongoose';
import Tournament from '../models/tournament.model';
import Player from '../models/player.model';
import { ITournament, TournamentFormat, TournamentStatus, IMatch, IRound, TournamentDocument } from '../types/tournament.types';
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
  async createTournament(tournamentData: any) {
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
    if (allPlayers.length < 2) {
      throw new Error('Tournament needs at least 2 players');
    }

    const rounds: IRound[] = [];
    let roundNumber = 1;

    switch (tournament.format) {
      case TournamentFormat.ROUNDROBIN:
        for (let i = 0; i < allPlayers.length - 1; i++, roundNumber++) {
          const matches: IMatch[] = [];
          for (let j = i + 1; j < allPlayers.length; j++) {
            matches.push({
              player1: allPlayers[j]._id,
              player2: allPlayers[i]._id,
              winner: null,
              result: ''
            });
          }
          rounds.push({
            roundNumber,
            matches,
            completed: false
          });
        }
        break;

      case TournamentFormat.SINGLEELIMINATION: {
        let currentPlayers = [...allPlayers];

        // Calculate number of byes needed
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(currentPlayers.length)));
        const numByes = bracketSize - currentPlayers.length;

        // Create first round matches with byes
        const firstRoundMatches: IMatch[] = [];
        const playersWithByes: PlayerDocument[] = [];

        // Shuffle players
        for (let i = currentPlayers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [currentPlayers[i], currentPlayers[j]] = [currentPlayers[j], currentPlayers[i]];
        }

        // Create matches and handle byes
        for (let i = 0; i < currentPlayers.length; i += 2) {
          if (i + 1 < currentPlayers.length) {
            firstRoundMatches.push({
              player1: currentPlayers[i]._id,
              player2: currentPlayers[i + 1]._id,
              winner: null,
              result: ''
            });
          } else {
            // Player gets a bye to next round
            playersWithByes.push(currentPlayers[i]);
          }
        }

        // Add first round if there are matches
        if (firstRoundMatches.length > 0) {
          rounds.push({
            roundNumber: roundNumber++,
            matches: firstRoundMatches,
            completed: false
          });
        }

        // Add remaining players with byes to next round
        currentPlayers = playersWithByes;

        // Generate subsequent rounds
        while (currentPlayers.length > 1) {
          const matches: IMatch[] = [];
          for (let i = 0; i < currentPlayers.length; i += 2) {
            matches.push({
              player1: currentPlayers[i]._id,
              player2: currentPlayers[i + 1]._id,
              winner: null,
              result: ''
            });
          }

          rounds.push({
            roundNumber: roundNumber++,
            matches,
            completed: false
          });

          currentPlayers = currentPlayers.slice(0, currentPlayers.length / 2);
        }
        break;
      }

      case TournamentFormat.DOUBLEELIMINATION: {
        let winnersBracket: PlayerDocument[] = [...allPlayers];
        let losersBracket: PlayerDocument[] = [];

        // Calculate initial bracket size
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(winnersBracket.length)));

        // Shuffle initial players
        for (let i = winnersBracket.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [winnersBracket[i], winnersBracket[j]] = [winnersBracket[j], winnersBracket[i]];
        }

        // Winners bracket rounds
        while (winnersBracket.length > 1) {
          const matches: IMatch[] = [];
          const losers: PlayerDocument[] = [];

          // Create matches for this round
          for (let i = 0; i < winnersBracket.length; i += 2) {
            if (i + 1 < winnersBracket.length) {
              matches.push({
                player1: winnersBracket[i]._id,
                player2: winnersBracket[i + 1]._id,
                winner: null,
                result: ''
              });
              // Track potential losers for losers bracket
              losers.push(winnersBracket[i], winnersBracket[i + 1]);
            } else {
              // Odd player gets a bye
              winnersBracket = [winnersBracket[i]];
              break;
            }
          }

          if (matches.length > 0) {
            rounds.push({
              roundNumber: roundNumber++,
              matches,
              completed: false
            });
          }

          // Add losers to losers bracket
          losersBracket.push(...losers);
          
          // Prepare for next round
          winnersBracket = winnersBracket.slice(0, Math.ceil(winnersBracket.length / 2));
        }

        // Losers bracket rounds
        while (losersBracket.length > 1) {
          const matches: IMatch[] = [];

          for (let i = 0; i < losersBracket.length; i += 2) {
            if (i + 1 < losersBracket.length) {
              matches.push({
                player1: losersBracket[i]._id,
                player2: losersBracket[i + 1]._id,
                winner: null,
                result: ''
              });
            }
          }

          if (matches.length > 0) {
            rounds.push({
              roundNumber: roundNumber++,
              matches,
              completed: false
            });
          }

          losersBracket = losersBracket.slice(0, Math.ceil(losersBracket.length / 2));
        }

        // Final championship round(s)
        if (winnersBracket.length === 1 && losersBracket.length === 1) {
          rounds.push({
            roundNumber: roundNumber++,
            matches: [{
              player1: winnersBracket[0]._id,
              player2: losersBracket[0]._id,
              winner: null,
              result: ''
            }],
            completed: false
          });
        }
        break;
      }

      case TournamentFormat.SWISS: {
        const matches = await this.generateSwissPairings(tournamentId);
        rounds.push({
          roundNumber: roundNumber++,
          matches,
          completed: false
        });
        break;
      }

      default:
        throw new Error('Invalid tournament format');
    }

    // Convert populated tournament back to regular tournament for save
    const tournamentToSave = tournament.toObject();
    tournamentToSave.status = TournamentStatus.ONGOING;
    tournamentToSave.rounds = rounds;

    // Update and return as TournamentDocument
    return await Tournament.findByIdAndUpdate(
      tournamentId,
      { $set: tournamentToSave },
      { new: true }
    ).exec();
  }

  async updateTournamentResults(
    tournamentId: string,
    matchId: string,
    winnerId: string,
    result: string
  ): Promise<TournamentDocument | null> {
    const tournament = await Tournament.findById(tournamentId)
      .populate<{ players: PlayerDocument[] }>('players')
      .exec() as PopulatedTournament | null;
      
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

    // Update match result
    match.winner = toObjectId(winnerId);
    match.result = result;

    // Update player statistics
    const winner = await Player.findById<PlayerDocument>(winnerId);
    const loser = await Player.findById<PlayerDocument>(
      match.player1.toString() === winnerId ? match.player2 : match.player1
    );

    if (!winner || !loser) {
      throw new Error('Players not found');
    }

    // Initialize ratings if they don't exist
    if (typeof winner.rating !== 'number') winner.rating = 1500;
    if (typeof loser.rating !== 'number') loser.rating = 1500;

    // Calculate rating changes (ELO-style)
    const K = 32; // Rating change factor
    const expectedWinnerScore = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
    const ratingChange = Math.round(K * (1 - expectedWinnerScore));

    // Update winner stats
    winner.wins = (winner.wins || 0) + 1;
    winner.rating += ratingChange;
    await winner.save();

    // Update loser stats
    loser.losses = (loser.losses || 0) + 1;
    loser.rating -= ratingChange;
    await loser.save();

    // Check if round is complete
    const isRoundComplete = round.matches.every(m => m.winner);
    if (isRoundComplete) {
      round.completed = true;

      // Check if tournament is complete
      const tournamentDoc = convertToTournamentDocument(tournament);
      if (await this.checkTournamentCompletion(tournamentDoc)) {
        tournament.status = TournamentStatus.COMPLETED;
      }
    }

    // Save changes
    await tournament.save();

    // Return updated tournament with populated data
    return await Tournament.findById(tournamentId)
      .populate('players')
      .populate({
        path: 'rounds.matches.player1',
        select: 'name rank rating wins losses draws'
      })
      .populate({
        path: 'rounds.matches.player2',
        select: 'name rank rating wins losses draws'
      })
      .populate({
        path: 'rounds.matches.winner',
        select: 'name rank rating wins losses draws'
      })
      .exec();
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

      // 寻找最近积分的未配对选手
      let bestMatch = null;
      let allowRematch = false;
      
      while (!bestMatch) {
        for (let j = i + 1; j < playerScores.length; j++) {
          const player2 = playerScores[j];
          if (paired.has(player2.player)) continue;

          // 检查是否已经对战过
          const played = await this.havePlayed(tournamentId, player1.player, player2.player);

          if (!played || allowRematch) {
            bestMatch = player2;
            break;
          }
        }

        // 如果没有找到配对，允许重复对战
        if (!bestMatch && !allowRematch) {
          allowRematch = true;
        } else {
          break;
        }
      }

      // 如果找到配对
      if (bestMatch) {
        paired.add(player1.player);
        paired.add(bestMatch.player);
        matches.push({
          player1: new Types.ObjectId(player1.player),
          player2: new Types.ObjectId(bestMatch.player),
          winner: null,
          result: ''
        });
      }
    }

    // 处理剩余未配对的选手（如果有）
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
    await tournament.save();

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
}
