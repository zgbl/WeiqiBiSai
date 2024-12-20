import { Types } from 'mongoose';
import Tournament from '../models/tournament.model';
import Player from '../models/player.model';
import { TournamentFormat, TournamentStatus } from '../types/tournament.types';

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
  async generatePairings(tournamentId: string) {
    const tournament = await Tournament.findById(tournamentId)
      .populate('players', 'name rank')
      .populate({
        path: 'rounds.matches.winner',
        select: 'name rank'
      })
      .exec();

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Check if tournament has enough players
    if (!tournament.players || tournament.players.length < 2) {
      throw new Error('Tournament needs at least 2 players to start');
    }

    // If tournament is not started yet, start it
    if (tournament.status === TournamentStatus.UPCOMING) {
      tournament.status = TournamentStatus.ONGOING;
    }

    // For round-robin format
    if (tournament.format === TournamentFormat.ROUNDROBIN) {
      const players = tournament.players;
      const n = players.length;
      const rounds = [];

      // If odd number of players, add a dummy player for byes
      const allPlayers = n % 2 === 0 ? [...players] : [...players, null];
      const numRounds = allPlayers.length - 1;
      const numPairs = Math.floor(allPlayers.length / 2);

      // Generate all rounds using circle method
      for (let round = 0; round < numRounds; round++) {
        const matches = [];
        
        // Generate matches for this round
        for (let pair = 0; pair < numPairs; pair++) {
          const player1Index = pair;
          const player2Index = allPlayers.length - 1 - pair;

          // Skip matches with dummy player (byes)
          if (allPlayers[player1Index] && allPlayers[player2Index]) {
            matches.push({
              player1: new Types.ObjectId(allPlayers[player1Index]._id),
              player2: new Types.ObjectId(allPlayers[player2Index]._id),
              winner: null,
              result: ''
            });
          }
        }

        // Add the round
        rounds.push({
          roundNumber: round + 1,
          matches: matches,
          completed: false
        });

        // Rotate players for next round (keep first player fixed)
        const lastPlayer = allPlayers[allPlayers.length - 1];
        for (let i = allPlayers.length - 1; i > 1; i--) {
          allPlayers[i] = allPlayers[i - 1];
        }
        allPlayers[1] = lastPlayer;
      }

      // Clear any existing rounds and add all new rounds
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

    throw new Error('Unsupported tournament format');
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
    match.winner = new Types.ObjectId(winnerId);

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
