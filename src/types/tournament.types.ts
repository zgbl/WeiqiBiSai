import { Types } from 'mongoose';
import { MongoId, WithMongoId } from './mongoose.types';

export enum TournamentFormat {
  ROUNDROBIN = 'ROUNDROBIN',
  SINGLEELIMINATION = 'SINGLEELIMINATION',
  DOUBLEELIMINATION = 'DOUBLEELIMINATION',
  SWISS = 'SWISS'
}

export enum TournamentStatus {
  UPCOMING = 'UPCOMING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED'
}

export interface IMatch {
  _id?: Types.ObjectId;
  player1: MongoId;
  player2: MongoId;
  winner?: MongoId | null;
  result: string;
  player1Score?: number;  // 用于瑞士制
  player2Score?: number;
  round?: number;        // 所属轮次
}

export interface IRound {
  roundNumber: number;
  matches: IMatch[];
  completed: boolean;
}

export interface ITournament {
  _id?: Types.ObjectId;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: Date;
  endDate: Date;
  players: MongoId[];
  rounds: IRound[];
  description?: string;
  createdBy?: MongoId;
}

export type TournamentDocument = WithMongoId<ITournament>;
