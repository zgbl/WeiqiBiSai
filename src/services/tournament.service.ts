import { Types } from 'mongoose';
import Tournament from '../models/tournament.model';
import Player from '../models/player.model';
import { ITournament, TournamentFormat, TournamentStatus, IMatch, IRound } from '../types/tournament.types';
import { MongoId, toObjectId } from '../types/mongoose.types';

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

  async getTournamentById(id: string) {
    return await Tournament.findById(id)
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
  }

  // Generate pairings for the next round
  async generatePairings(tournamentId: string): Promise<ITournament | null> {
    const tournament = await Tournament.findById(tournamentId)
      .populate('players')
      .exec();

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const allPlayers = tournament.players;
    const rounds: IRound[] = [];

    if (tournament.format === TournamentFormat.ROUNDROBIN) {
      for (let i = 0; i < allPlayers.length - 1; i++) {
        const matches: IMatch[] = [];
        for (let j = i + 1; j < allPlayers.length; j++) {
          matches.push({
            player1: toObjectId(allPlayers[i]._id),
            player2: toObjectId(allPlayers[j]._id),
            winner: null,
            result: ''
          });
        }
        rounds.push({
          roundNumber: i + 1,
          matches,
          completed: false
        });
      }
    }

    tournament.status = TournamentStatus.ONGOING;
    tournament.rounds = rounds;

    await tournament.save();
    
    return await Tournament.findById(tournamentId)
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
  }

  async getPlayerById(id: string): Promise<any> {
    return Player.findById(id).exec();
  }

  // Record match result
  async recordMatchResult(tournamentId: string, matchId: string, winnerId: string) {
    console.log('Recording match result:', { tournamentId, matchId, winnerId });
    
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    console.log('Found tournament:', tournament.name);

    // Find the match in the current round
    const currentRound = tournament.rounds[tournament.rounds.length - 1];
    console.log('Current round:', currentRound.roundNumber);
    console.log('Matches in round:', JSON.stringify(currentRound.matches, null, 2));

    // Try to find the match in any round (in case it's not in the current round)
    let matchFound = false;
    let match;

    for (const round of tournament.rounds) {
      const matchIndex = round.matches.findIndex(
        m => m._id.toString() === matchId
      );

      if (matchIndex !== -1) {
        match = round.matches[matchIndex];
        matchFound = true;
        break;
      }
    }

    if (!matchFound || !match) {
      console.log('Match not found. Available matches:', 
        tournament.rounds.flatMap(r => r.matches.map(m => ({
          roundNumber: r.roundNumber,
          matchId: m._id.toString(),
          player1: m.player1.toString(),
          player2: m.player2?.toString()
        }))));
      throw new Error('Match not found');
    }

    console.log('Found match:', match);

    // Validate winner is one of the players
    if (match.player1.toString() !== winnerId && 
        (match.player2 && match.player2.toString() !== winnerId)) {
      throw new Error('Invalid winner');
    }

    // Record the winner
    match.winner = toObjectId(winnerId);

    // Check if round is complete
    const round = tournament.rounds.find(r => 
      r.matches.some(m => m._id.toString() === matchId)
    );
    
    if (round) {
      const isRoundComplete = round.matches.every(m => m.winner);
      if (isRoundComplete) {
        round.completed = true;

        // If this was the final round (only one winner), mark tournament as completed
        if (round.matches.length === 1) {
          tournament.status = TournamentStatus.COMPLETED;
        } else {
          // Update tournament status to ongoing if not already
          if (tournament.status === TournamentStatus.UPCOMING) {
            tournament.status = TournamentStatus.ONGOING;
          }
        }
      }
    }

    await tournament.save();
    return await this.getTournamentById(tournamentId);
  }
}
