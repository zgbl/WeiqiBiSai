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

export interface IPlayerScore {
  _id?: Types.ObjectId;
  player: MongoId;
  currentScore: number;
  initialScore: number;
  wins: number;
  losses: number;
  draws: number;
  opponents: MongoId[];
}

export interface IMatch {
  _id?: Types.ObjectId;
  player1: Types.ObjectId;
  player2: Types.ObjectId;
  winner: Types.ObjectId | null;
  result: string;
  player1Score: number;  // McMahon 赛制中选手的当前分数
  player2Score: number;  // McMahon 赛制中选手的当前分数
  round?: number;        
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
  
  // McMahon specific fields
  upperBar?: number;
  initialScore?: number;
  minimumScore?: number;
  roundCount?: number;
  groups?: string[];
  playerScores?: IPlayerScore[];
}

export type TournamentDocument = WithMongoId<ITournament>;
