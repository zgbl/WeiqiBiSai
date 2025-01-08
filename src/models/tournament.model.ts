import { Schema, model, Types } from 'mongoose';
import { ITournament, TournamentFormat, TournamentStatus } from '../types/tournament.types';

const matchSchema = new Schema({
  player1: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  player2: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  winner: { type: Schema.Types.ObjectId, ref: 'Player' },
  result: { type: String, default: '' },
  // McMahon specific fields
  player1Score: { type: Number, default: null },
  player2Score: { type: Number, default: null }
});

const roundSchema = new Schema({
  roundNumber: { type: Number, required: true },
  matches: [matchSchema],
  completed: { type: Boolean, default: false }
});

const playerScoreSchema = new Schema({
  player: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  currentScore: { type: Number, required: true },
  //initialScore: { type: Number, required: true },  // 造成update 得分的时候error, 改成false
  initialScore: { type: Number, required: false },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  opponents: [{ type: Schema.Types.ObjectId, ref: 'Player' }]
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
  description: String,
  
  // McMahon specific fields
  upperBar: { type: Number }, // 上限分段位
  initialScore: { type: Number }, // 最高段位选手的起始分数
  minimumScore: { type: Number }, // 最低分数限制
  roundCount: { type: Number }, // 总轮数
  groups: [{ type: String }], // 分组
  playerScores: [playerScoreSchema] // 选手分数记录
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
tournamentSchema.index({ name: 1 });
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ startDate: 1 });
tournamentSchema.index({ 'playerScores.currentScore': 1 }); // Index for McMahon pairing

export default model<ITournament>('Tournament', tournamentSchema);
