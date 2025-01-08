export enum TournamentStatus {
  UPCOMING = 'UPCOMING',
  PENDING = 'PENDING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED'
}

export enum TournamentFormat {
  MCMAHON = 'MCMAHON',
  SWISS = 'SWISS',
  SINGLEELIMINATION = 'SINGLEELIMINATION',
  DOUBLEELIMINATION = 'DOUBLEELIMINATION',
  ROUNDROBIN = 'ROUNDROBIN'
}

export interface Player {
  _id: string;
  name: string;
  rank: string;
  rating?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  group?: string;
}

export interface Match {
  _id?: string;
  player1: Player;
  player2: Player;
  winner?: Player;
  result?: string;
}

export interface Round {
  roundNumber: number;
  matches: Match[];
  completed: boolean;
}

export interface Tournament {
  _id?: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: Date;
  endDate: Date;
  players: Player[];
  rounds: Round[];
  description?: string;
  currentRound: number;
  groups?: string[];
}
