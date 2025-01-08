import { Schema, model, Types, Document } from 'mongoose';
import { ITournament, TournamentFormat, TournamentStatus } from '../types/tournament.types';
import { IMatch } from './match.model';

// 段位范围定义
export interface RankRange {
  minRank: string;
  maxRank: string;
  mcMahonPoints: number;
}

// McMahon 分组定义
export const DEFAULT_MCMAHON_BANDS: RankRange[] = [
  { minRank: "9d", maxRank: "5d", mcMahonPoints: 3 },  // 公开组
  { minRank: "4d", maxRank: "1d", mcMahonPoints: 2 },  // 高段组
  { minRank: "1k", maxRank: "5k", mcMahonPoints: 1 },  // 中级组
  { minRank: "6k", maxRank: "20k", mcMahonPoints: 0 }  // 初级组
];

interface ITournamentRound {
  roundNumber: number;
  matches: Types.ObjectId[];
  completed: boolean;
}

interface ITournament extends Document {
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: Date;
  endDate: Date;
  players: Types.ObjectId[];
  rounds: ITournamentRound[];
  description?: string;
  // McMahon specific fields
  upperBar?: number;
  initialScore?: number;
  minimumScore?: number;
  roundCount?: number;
  groups?: string[];
  playerScores?: { playerId: Types.ObjectId; score: number }[];
}

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
  rounds: [{
    roundNumber: { type: Number, required: true },
    matches: [{ type: Schema.Types.ObjectId, ref: 'Match' }],
    completed: { type: Boolean, default: false }
  }],
  description: { type: String },
  // McMahon specific fields
  upperBar: { type: Number },
  initialScore: { type: Number },
  minimumScore: { type: Number },
  roundCount: { type: Number },
  groups: [{ type: String }],
  playerScores: [{
    playerId: { type: Schema.Types.ObjectId, ref: 'Player' },
    score: { type: Number }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
tournamentSchema.index({ name: 1 });
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ startDate: 1 });
tournamentSchema.index({ 'playerScores.score': 1 }); // Index for McMahon pairing

export default model<ITournament>('Tournament', tournamentSchema);
