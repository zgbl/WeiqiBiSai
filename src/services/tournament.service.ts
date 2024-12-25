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
        
      default:
        return false;
    }
  }
}
