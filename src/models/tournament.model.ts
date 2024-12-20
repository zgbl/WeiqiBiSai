import mongoose, { Schema } from 'mongoose';
import { ITournament, TournamentFormat, TournamentStatus } from '../types/tournament.types';

const matchSchema = new Schema({
  player1: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  player2: { type: Schema.Types.ObjectId, ref: 'Player', required: false },
  winner: { type: Schema.Types.ObjectId, ref: 'Player' },
  score: {
    player1: { type: Number },
    player2: { type: Number }
  }
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
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: Object.values(TournamentStatus),
    default: TournamentStatus.UPCOMING
  },
  players: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  rounds: [roundSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' } 
}, {
  timestamps: true
});

// Indexes
tournamentSchema.index({ name: 1 });
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ startDate: 1 });

export default mongoose.model<ITournament>('Tournament', tournamentSchema);
