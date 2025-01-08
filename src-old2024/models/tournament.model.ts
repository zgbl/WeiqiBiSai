import { Schema, model } from 'mongoose';
import { ITournament } from '../types/tournament.types';
import { TournamentFormat, TournamentStatus } from '../types/tournament.types';

const matchSchema = new Schema({
  player1: { type: Schema.Types.ObjectId, ref: 'Player' },
  player2: { type: Schema.Types.ObjectId, ref: 'Player' },
  winner: { type: Schema.Types.ObjectId, ref: 'Player' },
  result: String
});

const roundSchema = new Schema({
  roundNumber: { type: Number, required: true },
  matches: [matchSchema],
  completed: { type: Boolean, default: false }
});

const tournamentSchema = new Schema({
  name: { type: String, required: true },
  format: {
    type: String,
    enum: Object.values(TournamentFormat),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(TournamentStatus),
    default: TournamentStatus.PENDING
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  players: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  rounds: [roundSchema],
  description: String,
  currentRound: { type: Number, default: 0 },
  groups: [String]
}, {
  timestamps: true
});

// Indexes
tournamentSchema.index({ name: 1 });
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ startDate: 1 });

const Tournament = model<ITournament>('Tournament', tournamentSchema);
export { Tournament };
