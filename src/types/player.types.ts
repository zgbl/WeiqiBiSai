export interface IPlayer {
  name: string;
  rank: string; // e.g., "1d", "2k"
  rating?: number;
  tournaments: string[]; // Array of tournament IDs
  wins: number;
  losses: number;
  draws: number;
}

export interface IPlayerStats {
  totalGames: number;
  winRate: number;
  tournamentResults: {
    tournamentId: string;
    position: number;
    score: number;
  }[];
}
