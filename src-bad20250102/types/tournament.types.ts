import { Types } from 'mongoose';
import { MongoId, WithMongoId } from './mongoose.types';

export enum TournamentFormat {
  ROUNDROBIN = 'ROUNDROBIN',
  SINGLEELIMINATION = 'SINGLEELIMINATION',
  DOUBLEELIMINATION = 'DOUBLEELIMINATION',
  SWISS = 'SWISS',
  MCMAHON = 'MCMAHON'
}

export enum TournamentStatus {
  UPCOMING = 'UPCOMING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED'
}

export interface IMatch {
  _id?: Types.ObjectId;
  tournament: Types.ObjectId;
  round: number;
  player1: Types.ObjectId;
  player2: Types.ObjectId;
  winner?: Types.ObjectId;
  player1Score: number;
  player2Score: number;
  tableNumber: number;
}

export interface IRound {
  roundNumber: number;
  matches: Types.ObjectId[];
  completed: boolean;
}

export interface ITournament {
  _id?: Types.ObjectId;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: Date;
  endDate: Date;
  players: Types.ObjectId[];
  rounds: IRound[];
  description?: string;
  // McMahon specific fields
  upperBar?: number;
  initialScore?: number;
  minimumScore?: number;
  roundCount?: number;
  groups?: string[];
  playerScores?: { playerId: Types.ObjectId; score: number }[];
}

export type TournamentDocument = WithMongoId<ITournament>;
