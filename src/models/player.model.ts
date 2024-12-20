import mongoose, { Schema } from 'mongoose';
import { IPlayer } from '../types/player.types';

const playerSchema = new Schema({
  name: { type: String, required: true },
  rank: { type: String, required: true },
  rating: { type: Number },
  tournaments: [{ type: Schema.Types.ObjectId, ref: 'Tournament' }],
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Indexes
playerSchema.index({ name: 1 });
playerSchema.index({ rank: 1 });
playerSchema.index({ rating: 1 });

// Virtual for total games
playerSchema.virtual('totalGames').get(function(this: IPlayer) {
  return this.wins + this.losses + this.draws;
});

// Virtual for win rate
playerSchema.virtual('winRate').get(function(this: IPlayer) {
  const totalGames = this.wins + this.losses + this.draws;
  return totalGames > 0 ? (this.wins / totalGames) * 100 : 0;
});

export default mongoose.model<IPlayer>('Player', playerSchema);
