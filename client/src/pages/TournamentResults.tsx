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

interface Player {
  _id: string;
  name: string;
  rank?: string;
}

interface TournamentResult {
  player: Player;
  wins: number;
  losses: number;
  rank: number;
}

interface Tournament {
  _id: string;
  name: string;
  type: string;
  results: TournamentResult[];
}

const TournamentResults = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await axios.get(`http://localhost:3000/api/tournaments/${id}/results`);
        setTournament(response.data);
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

  if (!tournament) {
    return <Typography>Tournament not found</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {tournament.name} - Final Results
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Player</TableCell>
                <TableCell align="right">Wins</TableCell>
                <TableCell align="right">Losses</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tournament.results.map((result) => (
                <TableRow key={result.player._id}>
                  <TableCell>{result.rank}</TableCell>
                  <TableCell>{result.player.name}</TableCell>
                  <TableCell align="right">{result.wins}</TableCell>
                  <TableCell align="right">{result.losses}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Button
        variant="contained"
        onClick={() => navigate(`/tournament/${id}`)}
        sx={{ mr: 2 }}
      >
        Back to Tournament
      </Button>
      <Button
        variant="outlined"
        onClick={() => navigate('/tournaments')}
      >
        All Tournaments
      </Button>
    </Box>
  );
};

export default TournamentResults;
