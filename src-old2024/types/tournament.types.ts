import { Document } from 'mongoose';

export enum TournamentFormat {
  MCMAHON = 'MCMAHON',
  SWISS = 'SWISS',
  SINGLEELIMINATION = 'SINGLEELIMINATION',
  DOUBLEELIMINATION = 'DOUBLEELIMINATION',
  ROUNDROBIN = 'ROUNDROBIN'
}

export enum TournamentStatus {
  PENDING = 'PENDING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED'
}

export interface IMatch {
  player1: any;
  player2: any;
  winner?: any;
  result?: string;
}

export interface IRound {
  roundNumber: number;
  matches: IMatch[];
  completed: boolean;
}

export interface ITournament extends Document {
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: Date;
  endDate: Date;
  players: any[];
  rounds: IRound[];
  description?: string;
  currentRound: number;
  groups?: string[];
}
