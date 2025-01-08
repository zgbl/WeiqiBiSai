import mongoose, { Schema, Document } from 'mongoose';
import { Types } from 'mongoose';

export interface IMatch extends Document {
  tournament: Types.ObjectId;
  round: number;
  player1: Types.ObjectId;
  player2: Types.ObjectId;
  winner?: Types.ObjectId;
  player1Score: number;
  player2Score: number;
  tableNumber: number;
}

const matchSchema = new Schema<IMatch>({
  tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
  round: { type: Number, required: true },
  player1: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  player2: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  winner: { type: Schema.Types.ObjectId, ref: 'Player' },
  player1Score: { type: Number, default: 0 },
  player2Score: { type: Number, default: 0 },
  tableNumber: { type: Number, required: true }
});

export default mongoose.model<IMatch>('Match', matchSchema);
