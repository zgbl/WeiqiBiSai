import { Types } from 'mongoose';
import { MongoId } from './mongoose.types';

export enum TournamentFormat {
  KNOCKOUT = 'knockout',
  ROUNDROBIN = 'roundrobin',
  SWISS = 'swiss',
  MCMAHON = 'mcmahon'
}

export enum TournamentStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  COMPLETED = 'completed'
}

export interface ITournament {
  _id?: Types.ObjectId;
  name: string;
  format: TournamentFormat;
  startDate: Date;
  endDate: Date;
  description?: string;
  status: TournamentStatus;
  players: MongoId[];
  rounds: IRound[];
  createdBy?: MongoId;
}

export interface IRound {
  roundNumber: number;
  matches: IMatch[];
  completed: boolean;
}

export interface IMatch {
  _id?: Types.ObjectId;
  player1: MongoId;
  player2?: MongoId;
  winner?: MongoId;
  score?: {
    player1: number;
    player2: number;
  };
}
