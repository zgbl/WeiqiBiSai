import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

interface Player {
  _id: string;
  name: string;
  rank?: string;
}

interface TournamentResult {
  rank: number;
  player: Player;
  score: number;
  opponentScore: number;
  totalScore: number;
  wins: number;
  losses: number;
}

interface Tournament {
  _id: string;
  name: string;
  format: string;
  results: TournamentResult[];
}

const TournamentResults = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [results, setResults] = useState<TournamentResult[]>([]);
  const [tournamentName, setTournamentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/tournaments/${id}/results`);
        setResults(response.data.results || []);
        setTournamentName(response.data.name || '');
      } catch (error: any) {
        setError(error.response?.data?.message || 'Failed to fetch tournament results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [id]);

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {tournamentName} - Final Results
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Player</TableCell>
                <TableCell align="right">Score</TableCell>
                <TableCell align="right">Opponent Score</TableCell>
                <TableCell align="right">Total Score</TableCell>
                <TableCell align="right">Wins</TableCell>
                <TableCell align="right">Losses</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.player._id}>
                  <TableCell>{result.rank}</TableCell>
                  <TableCell>{result.player.name}</TableCell>
                  <TableCell align="right">{result.score}</TableCell>
                  <TableCell align="right">{result.opponentScore}</TableCell>
                  <TableCell align="right">{result.totalScore.toFixed(2)}</TableCell>
                  <TableCell align="right">{result.wins}</TableCell>
                  <TableCell align="right">{result.losses}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box sx={{ mt: 2 }}>
        <Button variant="contained" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </Box>
    </Box>
  );
};

export default TournamentResults;
