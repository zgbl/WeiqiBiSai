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
  name: string;
  format: TournamentFormat;
  startDate: Date;
  endDate: Date;
  description?: string;
  status: TournamentStatus;
  players: string[]; // Array of player IDs
  rounds: IRound[];
  createdBy?: string; // User ID, optional for now
}

export interface IRound {
  roundNumber: number;
  matches: IMatch[];
  completed: boolean;
}

export interface IMatch {
  player1: string; // Player ID
  player2?: string; // Player ID, optional for byes
  winner?: string; // Winner ID
  score?: {
    player1: number;
    player2: number;
  };
}
