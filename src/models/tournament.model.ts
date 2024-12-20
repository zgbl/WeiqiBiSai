import { Schema, model, Types } from 'mongoose';
import { ITournament, TournamentFormat, TournamentStatus } from '../types/tournament.types';

const matchSchema = new Schema({
  player1: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  player2: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  winner: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
  result: { type: String, default: '' }
});

const roundSchema = new Schema({
  roundNumber: { type: Number, required: true },
  matches: [matchSchema],
  completed: { type: Boolean, default: false }
});

const tournamentSchema = new Schema<ITournament>({
  name: { type: String, required: true },
  format: { 
    type: String, 
    enum: Object.values(TournamentFormat),
    required: true 
  },
  status: { 
    type: String, 
    enum: Object.values(TournamentStatus),
    default: TournamentStatus.UPCOMING 
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  players: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  rounds: [roundSchema],
  description: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
tournamentSchema.index({ name: 1 });
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ startDate: 1 });

export default model<ITournament>('Tournament', tournamentSchema);
