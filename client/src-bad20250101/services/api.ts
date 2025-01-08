import axios from 'axios';

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('token');

// API configuration
export const API_PORT = import.meta.env.VITE_API_PORT || '3000';
export const API_HOST = import.meta.env.VITE_API_HOST || 'localhost';
export const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${API_HOST}:${API_PORT}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token if it's invalid/expired
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Tournament API
export const TournamentAPI = {
  getAll: async () => {
    const response = await api.get('/tournaments');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/tournaments/${id}`);
    return response.data;
  },

  create: async (data: Omit<Tournament, '_id'>) => {
    const response = await api.post('/tournaments', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Tournament>) => {
    const response = await api.put(`/tournaments/${id}`, data);
    return response.data;
  },

  addPlayer: async (tournamentId: string, data: { playerId?: string; name?: string; rank?: string }) => {
    try {
      if (data.playerId) {
        // Add existing player to tournament
        const response = await api.post(`/tournaments/${tournamentId}/players`, { playerId: data.playerId });
        return response.data;
      } else if (data.name && data.rank) {
        // Create new player first
        const newPlayer = await PlayerAPI.create({ name: data.name, rank: data.rank });
        // Then add to tournament
        const response = await api.post(`/tournaments/${tournamentId}/players`, { playerId: newPlayer._id });
        return response.data;
      } else {
        throw new Error('Either playerId or both name and rank must be provided');
      }
    } catch (error) {
      console.error('Error adding player:', error);
      throw error;
    }
  },

  generateRounds: async (tournamentId: string) => {
    const response = await api.post(`/tournaments/${tournamentId}/rounds`);
    return response.data;
  },

  updateMatchResult: async (tournamentId: string, matchId: string, data: { winnerId: string; result: string }) => {
    const response = await api.put(`/tournaments/${tournamentId}/matches/${matchId}`, data);
    return response.data;
  },

  deleteRound: async (tournamentId: string, roundNumber: number) => {
    const response = await api.delete(`/tournaments/${tournamentId}/rounds/${roundNumber}`);
    return response.data;
  }
};

// Player API
export const PlayerAPI = {
  getAll: async () => {
    const response = await api.get('/tournaments/players');
    return response.data;
  },

  create: async (data: { name: string; rank: string }) => {
    const response = await api.post('/tournaments/players', data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/tournaments/players/${id}`);
    return response.data;
  }
};

// Types
export interface Tournament {
  _id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: string;
  endDate: string;
  description?: string;
  players: Player[];
  rounds: Round[];
}

export interface Player {
  _id: string;
  name: string;
  rank: string;
  rating?: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface Match {
  _id: string;
  player1: Player;
  player2: Player;
  winner?: Player;
  result: string;
}

export interface Round {
  roundNumber: number;
  matches: Match[];
  completed: boolean;
}

export enum TournamentFormat {
  ROUNDROBIN = 'ROUNDROBIN',
  SINGLEELIMINATION = 'SINGLEELIMINATION',
  DOUBLEELIMINATION = 'DOUBLEELIMINATION'
}

export enum TournamentStatus {
  UPCOMING = 'UPCOMING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED'
}

export default api;
