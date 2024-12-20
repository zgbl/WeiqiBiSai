import { Types } from 'mongoose';
import { MongoId } from './mongoose.types';

export interface IPlayer {
  _id?: Types.ObjectId;
  name: string;
  rank: string; // e.g., "1d", "2k"
  rating?: number;
  tournaments: MongoId[]; // Array of tournament IDs
  wins: number;
  losses: number;
  draws: number;
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
