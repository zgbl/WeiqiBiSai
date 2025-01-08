import { Types, Document } from 'mongoose';
import { MongoId } from './mongoose.types';

export interface IPlayer extends Document {
  _id?: Types.ObjectId;
  name: string;
  rank: string; 
  rating?: number;
  group?: string;
  tournaments?: string[];
  wins: number;
  losses: number;
  draws: number;
  totalGames?: number;
  winRate?: number;
}

export interface IPlayerStats {
  totalGames: number;
  winRate: number;
  tournamentResults: {
    tournamentId: MongoId;
    position: number;
    score: number;
  }[];
}

export interface IPlayerResponse extends Omit<IPlayer, '_id' | 'tournaments'> {
  id: string;
  tournaments: string[];
}
