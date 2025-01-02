import { Model } from 'mongoose';
import { Tournament } from '../models/tournament.model';
import Player from '../models/player.model';
import { ITournament, IMatch, IRound, TournamentFormat, TournamentStatus } from '../types/tournament.types';

export class TournamentService {
  private tournamentModel: typeof Tournament;
  private playerModel: typeof Player;

  constructor() {
    this.tournamentModel = Tournament;
    this.playerModel = Player;
  }

  async createTournament(tournamentData: Partial<ITournament>): Promise<ITournament> {
    try {
      const tournament = new this.tournamentModel({
        ...tournamentData,
        status: TournamentStatus.PENDING,
        currentRound: 0,
        players: [],
        rounds: []
      });
      return await tournament.save();
    } catch (error) {
      console.error('Error in createTournament:', error);
      throw error;
    }
  }

  async getAllTournaments() {
    try {
      return await this.tournamentModel
        .find()
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
    } catch (error) {
      console.error('Error in getAllTournaments:', error);
      throw error;
    }
  }

  async getTournamentById(id: string): Promise<ITournament | null> {
    return this.tournamentModel.findById(id).exec();
  }

  // Generate pairings for the next round
  async generatePairings(tournamentId: string): Promise<ITournament | null> {
    try {
      console.log('Generating pairings for tournament:', tournamentId);
      
      const tournament = await this.tournamentModel.findById(tournamentId)
        .populate('players')
        .populate('rounds.matches.player1')
        .populate('rounds.matches.player2')
        .exec();

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Check if current round is completed
      const currentRound = tournament.rounds?.[tournament.rounds.length - 1];
      if (currentRound && !currentRound.completed) {
        const isRoundComplete = currentRound.matches.every(match => match.winner != null);
        if (!isRoundComplete) {
          throw new Error('Cannot generate next round until all matches in current round have results');
        }
        currentRound.completed = true;
      }

      // Generate matches based on tournament format
      let matches: IMatch[] = [];
      console.log('Generating matches for format:', tournament.format);
      
      switch (tournament.format) {
        case TournamentFormat.MCMAHON:
          matches = await this.generateMcMahonPairings(tournament);
          break;
        case TournamentFormat.SINGLEELIMINATION:
          matches = await this.generateSingleEliminationPairings(tournament);
          break;
        case TournamentFormat.SWISS:
          matches = await this.generateSwissPairings(tournament);
          break;
        default:
          throw new Error(`Unsupported tournament format: ${tournament.format}`);
      }

      if (!matches.length) {
        throw new Error('No matches generated');
      }

      // Validate matches
      matches.forEach((match, index) => {
        if (!match.player1 || !match.player2) {
          console.error(`Invalid match at index ${index}:`, match);
          throw new Error(`Invalid match: missing player1 or player2 at index ${index}`);
        }
      });

      // Create new round
      const newRound: IRound = {
        roundNumber: (tournament.rounds?.length || 0) + 1,
        matches: matches.map(match => ({
          player1: match.player1,
          player2: match.player2,
          winner: null,
          result: ''
        })),
        completed: false
      };

      // Update tournament
      tournament.rounds = tournament.rounds || [];
      tournament.rounds.push(newRound);
      tournament.status = TournamentStatus.ONGOING;
      
      await tournament.save();

      // Return updated tournament
      return await this.tournamentModel.findById(tournamentId)
        .populate('players')
        .populate('rounds.matches.player1')
        .populate('rounds.matches.player2')
        .exec();
    } catch (error) {
      console.error('Error in generatePairings:', error);
      throw error;
    }
  }

  async addPlayer(tournamentId: string, playerId: string): Promise<ITournament> {
    try {
      const tournament = await this.tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const player = await this.playerModel.findById(playerId);
      if (!player) {
        throw new Error('Player not found');
      }

      // Check if player is already in tournament
      if (tournament.players.includes(playerId)) {
        throw new Error('Player is already in this tournament');
      }

      // Add player to tournament
      tournament.players.push(playerId);
      await tournament.save();

      // Return populated tournament
      return await this.tournamentModel
        .findById(tournamentId)
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
    } catch (error) {
      console.error('Error in addPlayer:', error);
      throw error;
    }
  }

  async addPlayers(tournamentId: string, playerIds: string[]): Promise<ITournament> {
    try {
      const tournament = await this.tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Verify all players exist and are not already in the tournament
      const existingPlayers = new Set(tournament.players.map(id => id.toString()));
      const newPlayers = [];

      for (const playerId of playerIds) {
        // Skip if player already exists in tournament
        if (existingPlayers.has(playerId)) {
          continue;
        }

        const player = await this.playerModel.findById(playerId);
        if (!player) {
          throw new Error(`Player ${playerId} not found`);
        }

        newPlayers.push(playerId);
      }

      // Add all new players at once
      if (newPlayers.length > 0) {
        tournament.players.push(...newPlayers);
        await tournament.save();
      }

      // Return populated tournament
      return await this.tournamentModel
        .findById(tournamentId)
        .populate('players', 'name rank rating')
        .populate({
          path: 'rounds.matches.player1',
          select: 'name rank rating'
        })
        .populate({
          path: 'rounds.matches.player2',
          select: 'name rank rating'
        })
        .populate({
          path: 'rounds.matches.winner',
          select: 'name rank rating'
        })
        .exec();
    } catch (error) {
      console.error('Error in addPlayers:', error);
      throw error;
    }
  }

  async removePlayer(tournamentId: string, playerId: string): Promise<ITournament> {
    try {
      const tournament = await this.tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Remove player from tournament
      tournament.players = tournament.players.filter(
        (id: any) => id.toString() !== playerId
      );
      await tournament.save();

      // Return populated tournament
      return await this.tournamentModel
        .findById(tournamentId)
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
    } catch (error) {
      console.error('Error in removePlayer:', error);
      throw error;
    }
  }

  private async generateSwissPairings(tournament: any): Promise<IMatch[]> {
    try {
      const matches: IMatch[] = [];
      const usedPlayers = new Set<string>();

      // 计算每个选手的当前积分
      const playerScores = tournament.players.map((player: any) => {
        let score = 0;
        tournament.rounds?.forEach((round: any) => {
          round.matches.forEach((match: any) => {
            if (match.winner?.toString() === player._id.toString()) {
              score += 1;
            }
          });
        });
        return {
          player,
          score,
          opponents: tournament.rounds?.flatMap((round: any) =>
            round.matches
              .filter((match: any) =>
                match.player1.toString() === player._id.toString() ||
                match.player2.toString() === player._id.toString()
              )
              .map((match: any) =>
                match.player1.toString() === player._id.toString() ?
                match.player2.toString() : match.player1.toString()
              )
          ) || []
        };
      }).sort((a: any, b: any) => b.score - a.score);

      // 处理轮空
      if (playerScores.length % 2 !== 0) {
        const playerForBye = playerScores
          .filter(p => !usedPlayers.has(p.player._id.toString()))
          .reduce((least, current) => {
            const leastByes = tournament.rounds?.reduce((count: number, round: any) => {
              return count + (round.matches.some((m: any) => 
                m.result === 'BYE' && m.player1.toString() === least.player._id.toString()
              ) ? 1 : 0);
            }, 0) || 0;

            const currentByes = tournament.rounds?.reduce((count: number, round: any) => {
              return count + (round.matches.some((m: any) => 
                m.result === 'BYE' && m.player1.toString() === current.player._id.toString()
              ) ? 1 : 0);
            }, 0) || 0;

            return currentByes < leastByes ? current : least;
          }, playerScores[playerScores.length - 1]); // 选择积分最低的选手

        matches.push({
          player1: playerForBye.player._id,
          player2: playerForBye.player._id,
          winner: playerForBye.player._id,
          result: 'BYE'
        });
        usedPlayers.add(playerForBye.player._id.toString());
      }

      // 配对剩余选手
      for (const playerData of playerScores) {
        if (usedPlayers.has(playerData.player._id.toString())) {
          continue;
        }

        // 找到最合适的对手（积分接近且未对阵过）
        const bestOpponent = playerScores.find(opponent => {
          if (
            opponent.player._id.toString() === playerData.player._id.toString() ||
            usedPlayers.has(opponent.player._id.toString()) ||
            playerData.opponents.includes(opponent.player._id.toString())
          ) {
            return false;
          }
          return true;
        });

        if (bestOpponent) {
          matches.push({
            player1: playerData.player._id,
            player2: bestOpponent.player._id,
            winner: null,
            result: ''
          });
          usedPlayers.add(playerData.player._id.toString());
          usedPlayers.add(bestOpponent.player._id.toString());
        }
      }

      return matches;
    } catch (error) {
      console.error('Error generating Swiss pairings:', error);
      throw error;
    }
  }

  async generateNextRound(tournament: any) {
    try {
      console.log('Generating next round for tournament:', tournament._id);
      console.log('Tournament format:', tournament.format);

      if (!tournament.format) {
        throw new Error('Tournament format not specified');
      }

      if (!tournament.players || tournament.players.length === 0) {
        throw new Error('No players in tournament');
      }

      let matches: IMatch[] = [];
      switch (tournament.format) {
        case TournamentFormat.MCMAHON:
          matches = await this.generateMcMahonPairings(tournament);
          break;
        case TournamentFormat.SINGLEELIMINATION:
          matches = await this.generateSingleEliminationPairings(tournament);
          break;
        case TournamentFormat.SWISS:
          matches = await this.generateSwissPairings(tournament);
          break;
        default:
          throw new Error(`Unsupported tournament format: ${tournament.format}`);
      }

      if (!matches.length) {
        throw new Error('No matches generated');
      }

      // Validate matches
      matches.forEach((match, index) => {
        if (!match.player1 || !match.player2) {
          console.error(`Invalid match at index ${index}:`, match);
          throw new Error(`Invalid match: missing player1 or player2 at index ${index}`);
        }
      });

      // Create the new round with standardized match structure
      const newRound: IRound = {
        roundNumber: (tournament.rounds?.length || 0) + 1,
        matches: matches.map(match => ({
          player1: match.player1,
          player2: match.player2,
          winner: match.winner || null,
          result: match.result || ''
        })),
        completed: false
      };

      tournament.rounds = tournament.rounds || [];
      tournament.rounds.push(newRound);
      await tournament.save();
      
      return tournament;
    } catch (error: any) {
      console.error('Error generating next round:', error);
      throw error;
    }
  }

  private async generateMcMahonPairings(tournament: any): Promise<IMatch[]> {
    const matches: IMatch[] = [];
    const usedPlayers = new Set<string>();

    // 按组别分组
    const playersByGroup = tournament.players.reduce((groups: any, player: any) => {
      const group = player.group || 'Unassigned';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push({
        player,
        currentScore: 0,
        opponents: []
      });
      return groups;
    }, {});

    // 为每个组生成配对
    for (const group of Object.keys(playersByGroup)) {
      const groupPlayers = playersByGroup[group];
      
      // 如果该组是奇数人，处理轮空
      if (groupPlayers.length % 2 !== 0) {
        const playerWithLeastByes = groupPlayers
          .filter((p: any) => !usedPlayers.has(p.player._id.toString()))
          .reduce((least: any, current: any) => {
            const leastByes = tournament.rounds?.reduce((count: number, round: any) => {
              return count + (round.matches.some((m: any) => 
                m.result === 'BYE' && m.player1.toString() === least.player._id.toString()
              ) ? 1 : 0);
            }, 0) || 0;

            const currentByes = tournament.rounds?.reduce((count: number, round: any) => {
              return count + (round.matches.some((m: any) => 
                m.result === 'BYE' && m.player1.toString() === current.player._id.toString()
              ) ? 1 : 0);
            }, 0) || 0;

            return currentByes < leastByes ? current : least;
          }, groupPlayers[0]);

        matches.push({
          player1: playerWithLeastByes.player._id,
          player2: playerWithLeastByes.player._id,
          winner: playerWithLeastByes.player._id,
          result: 'BYE'
        });
        usedPlayers.add(playerWithLeastByes.player._id.toString());
      }

      // 配对剩余选手（同组内）
      for (const playerData of groupPlayers) {
        if (usedPlayers.has(playerData.player._id.toString())) {
          continue;
        }

        // 在同组中找对手
        const bestOpponent = groupPlayers.find((opponent: any) => {
          if (
            opponent.player._id.toString() === playerData.player._id.toString() ||
            usedPlayers.has(opponent.player._id.toString())
          ) {
            return false;
          }

          // 检查是否之前已经对阵过
          const havePlayed = tournament.rounds?.some((round: any) =>
            round.matches.some((match: any) =>
              (match.player1.toString() === playerData.player._id.toString() && match.player2.toString() === opponent.player._id.toString()) ||
              (match.player2.toString() === playerData.player._id.toString() && match.player1.toString() === opponent.player._id.toString())
            )
          );

          return !havePlayed;
        });

        if (bestOpponent) {
          matches.push({
            player1: playerData.player._id,
            player2: bestOpponent.player._id,
            winner: null,
            result: ''
          });

          usedPlayers.add(playerData.player._id.toString());
          usedPlayers.add(bestOpponent.player._id.toString());
        }
      }
    }

    return matches;
  }

  private async generateSingleEliminationPairings(tournament: any): Promise<IMatch[]> {
    const matches: IMatch[] = [];
    const activePlayers = tournament.players.filter((player: any) => {
      // Check if player is still in the tournament (hasn't lost in previous rounds)
      return !tournament.rounds.some((round: any) => 
        round.matches.some((match: any) => 
          (match.player1.toString() === player._id.toString() || 
           match.player2.toString() === player._id.toString()) &&
          match.winner &&
          match.winner.toString() !== player._id.toString()
        )
      );
    });

    // Pair remaining players randomly
    const shuffledPlayers = [...activePlayers];
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }

    // Create matches
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      if (i + 1 < shuffledPlayers.length) {
        matches.push({
          player1: shuffledPlayers[i]._id,
          player2: shuffledPlayers[i + 1]._id,
          winner: null,
          result: ''
        });
      } else {
        // Handle bye for odd number of players
        matches.push({
          player1: shuffledPlayers[i]._id,
          player2: shuffledPlayers[i]._id,
          winner: shuffledPlayers[i]._id,
          result: 'BYE'
        });
      }
    }

    return matches;
  }

  // 计算段位数值
  private getRankValue(rank: string): number {
    if (!rank) return 0;
    
    // 处理段位
    if (rank.endsWith('D') || rank.endsWith('d')) {
      return parseInt(rank) * 100; // 段位选手
    }
    // 处理级位
    if (rank.endsWith('K') || rank.endsWith('k')) {
      return -parseInt(rank); // 级位选手为负数
    }
    return 0;
  }

  // 确定选手组别
  private determineGroup(rank: string, players: any[]): string {
    const rankValue = this.getRankValue(rank);
    const strongPlayers = players.filter(p => 
      this.getRankValue(p.rank) >= 600  // 6段或以上
    ).length;

    // Open组的判断
    if (rankValue >= 600) return 'Open'; // 6段或以上直接进入Open组
    if (rankValue >= 500 && strongPlayers < 8) return 'Open'; // 5段在强选手不足时也可能进入Open组

    // 其他组别的判断
    if (rankValue >= 100) return 'Dan'; // 1-4段为段位组
    if (rankValue >= -10) return 'High-Kyu'; // 1-10级为高级组
    return 'Low-Kyu'; // 11级以下为低级组
  }

  // 计算初始分
  private calculateInitialScore(rank: string, group: string): number {
    const rankValue = this.getRankValue(rank);
    
    // Open组的初始分计算
    if (group === 'Open') {
      if (rankValue >= 800) return 8; // 8-9段
      if (rankValue >= 700) return 7; // 7段
      if (rankValue >= 600) return 6; // 6段
      return 5; // 5段
    }

    // 段位组的初始分计算
    if (group === 'Dan') {
      return Math.floor(rankValue / 100) + 1; // 1-4段
    }

    // 高级组的初始分计算
    if (group === 'High-Kyu') {
      return Math.max(0, Math.floor(-rankValue / 3)); // 每3级递减1分
    }

    // 低级组的初始分计算
    return 0; // 低级组统一从0分开始
  }

  // Calculate player scores
  calculatePlayerScores(tournament: any): Map<string, { score: number, opponentScore: number }> {
    const scores = new Map<string, { score: number, opponentScore: number }>();
    
    // Initialize all player scores to 0
    tournament.players.forEach((player: any) => {
      scores.set(player._id.toString(), { score: 0, opponentScore: 0 });
    });

    // If tournament hasn't started or no rounds, return all zeros
    if (!tournament.rounds || tournament.rounds.length === 0 || tournament.status === 'PENDING') {
      return scores;
    }

    // Only calculate scores for completed rounds after round 1
    tournament.rounds?.forEach((round: any, roundIndex: number) => {
      if (!round.completed || roundIndex === 0) {
        return;
      }

      round.matches.forEach((match: any) => {
        if (match.winner) {
          const winnerId = match.winner.toString();
          const loserId = match.player1.toString() === winnerId 
            ? match.player2.toString() 
            : match.player1.toString();

          // Get current scores
          const winnerScore = scores.get(winnerId) || { score: 0, opponentScore: 0 };
          const loserScore = scores.get(loserId) || { score: 0, opponentScore: 0 };

          // Winner gets 2 points
          scores.set(winnerId, {
            score: winnerScore.score + 2,
            opponentScore: winnerScore.opponentScore
          });

          // Update opponent scores
          if (match.result !== 'BYE') {
            scores.set(loserId, {
              score: loserScore.score,
              opponentScore: loserScore.opponentScore
            });
          }
        }
      });
    });

    return scores;
  }

  // Get player's current score
  getPlayerScore(scores: Map<string, { score: number, opponentScore: number }>, playerId: string): { score: number, opponentScore: number } {
    return scores.get(playerId) || { score: 0, opponentScore: 0 };
  }

  // Find head-to-head result between two players
  findHeadToHeadResult(tournament: any, player1Id: string, player2Id: string): string | null {
    for (const round of tournament.rounds || []) {
      for (const match of round.matches) {
        if ((match.player1.toString() === player1Id && match.player2.toString() === player2Id) ||
            (match.player1.toString() === player2Id && match.player2.toString() === player1Id)) {
          if (match.winner) {
            return match.winner.toString();
          }
        }
      }
    }
    return null;
  }

  // Get sorted player list
  getSortedPlayers(tournament: any): { player: any, score: number, opponentScore: number, totalScore: number }[] {
    const scores = this.calculatePlayerScores(tournament);
    
    // Find maximum score
    let maxScore = 0;
    scores.forEach(({ score }) => {
      if (score > maxScore) {
        maxScore = score;
      }
    });

    // Calculate round count
    const roundCount = tournament.rounds?.length || 0;
    
    const playersWithScores = tournament.players.map((player: any) => {
      const { score, opponentScore } = this.getPlayerScore(scores, player._id.toString());
      // Total score = personal score + (opponent score sum / (max score / 2)) - round count
      const totalScore = score + ((opponentScore / (maxScore / 2)) - roundCount);
      
      return {
        player: {
          ...player,
          score: undefined  // Remove the score from player object
        },
        score,
        opponentScore,
        totalScore
      };
    });

    // Sort by total score, then by head-to-head results
    return playersWithScores.sort((a, b) => {
      if (Math.abs(b.totalScore - a.totalScore) > 0.001) {
        return b.totalScore - a.totalScore;
      }
      
      const headToHeadWinner = this.findHeadToHeadResult(tournament, 
        a.player._id.toString(), 
        b.player._id.toString()
      );
      
      if (headToHeadWinner) {
        if (headToHeadWinner === b.player._id.toString()) return 1;
        if (headToHeadWinner === a.player._id.toString()) return -1;
      }
      
      return 0;
    });
  }

  // Delete a round from tournament
  async deleteRound(tournamentId: string, roundNumber: number): Promise<any> {
    try {
      const tournament = await this.tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Check if the round exists
      if (!tournament.rounds || roundNumber > tournament.rounds.length) {
        throw new Error('Round not found');
      }

      // Remove the specified round
      tournament.rounds.splice(roundNumber - 1, 1);

      // Renumber remaining rounds
      tournament.rounds.forEach((round: any, index: number) => {
        round.roundNumber = index + 1;
      });

      // Save the tournament
      await tournament.save();

      return tournament;
    } catch (error) {
      console.error('Error deleting round:', error);
      throw error;
    }
  }

  // Player management methods
  async getAllPlayers(): Promise<any[]> {
    try {
      return await this.playerModel.find().select('name rank').lean().exec();
    } catch (error) {
      console.error('Error in getAllPlayers:', error);
      throw error;
    }
  }

  async createPlayer(playerData: any): Promise<any> {
    try {
      const player = new this.playerModel(playerData);
      return await player.save();
    } catch (error) {
      console.error('Error in createPlayer:', error);
      throw error;
    }
  }

  async updatePlayer(playerId: string, playerData: any): Promise<any> {
    try {
      return await this.playerModel
        .findByIdAndUpdate(playerId, playerData, { new: true })
        .exec();
    } catch (error) {
      console.error('Error in updatePlayer:', error);
      throw error;
    }
  }

  async deletePlayer(playerId: string): Promise<void> {
    try {
      await this.playerModel.findByIdAndDelete(playerId).exec();
    } catch (error) {
      console.error('Error in deletePlayer:', error);
      throw error;
    }
  }

  async getPlayerById(playerId: string): Promise<any> {
    try {
      return await this.playerModel.findById(playerId).exec();
    } catch (error) {
      console.error('Error in getPlayerById:', error);
      throw error;
    }
  }

  async startTournament(tournamentId: string): Promise<ITournament> {
    try {
      const tournament = await this.tournamentModel.findById(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      if (tournament.players.length < 2) {
        throw new Error('Tournament needs at least 2 players to start');
      }

      // Generate first round matches
      const matches = await this.generateRoundMatches(tournament.players);
      
      // Create the first round
      tournament.rounds = [{
        roundNumber: 1,
        matches: matches,
        completed: false
      }];
      
      tournament.currentRound = 1;
      tournament.status = TournamentStatus.IN_PROGRESS;
      
      await tournament.save();

      // Return populated tournament
      return await this.tournamentModel
        .findById(tournamentId)
        .populate('players', 'name rank rating')
        .populate({
          path: 'rounds.matches.player1',
          select: 'name rank rating'
        })
        .populate({
          path: 'rounds.matches.player2',
          select: 'name rank rating'
        })
        .populate({
          path: 'rounds.matches.winner',
          select: 'name rank rating'
        })
        .exec();
    } catch (error) {
      console.error('Error in startTournament:', error);
      throw error;
    }
  }

  private async generateRoundMatches(players: any[]): Promise<IMatch[]> {
    // Shuffle players randomly
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const matches: IMatch[] = [];
    
    // If odd number of players, one gets a bye
    if (shuffledPlayers.length % 2 !== 0) {
      const byePlayer = shuffledPlayers.pop();
      matches.push({
        player1: byePlayer,
        player2: null,
        winner: byePlayer,
        result: 'BYE'
      });
    }

    // Create matches for remaining players
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      matches.push({
        player1: shuffledPlayers[i],
        player2: shuffledPlayers[i + 1],
        winner: null,
        result: null
      });
    }

    return matches;
  }
}
