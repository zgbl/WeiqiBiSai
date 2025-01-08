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
  playerStats?: any[];
  players?: Player[];
}

const TournamentResults = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [results, setResults] = useState<TournamentResult[]>([]);
  const [tournamentName, setTournamentName] = useState('');
  const [tournament, setTournament] = useState<Tournament>({ _id: '', name: '', format: '', results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await axios.get(`http://localhost:3000/api/tournaments/${id}/results`);
        setResults(response.data.results || []);
        setTournament(response.data);
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

      {tournament.format === 'MCMAHON' && (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Dan/Kyu</TableCell>
                <TableCell>Group</TableCell>
                <TableCell>McMahon Score</TableCell>
                <TableCell>Wins</TableCell>
                <TableCell>Losses</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tournament.playerStats
                ?.sort((a, b) => {
                  // 首先按分组排序
                  const groupOrder = { 'Open': 0, 'Dan': 1, 'High-Kyu': 2, 'Low-Kyu': 3 };
                  if (groupOrder[a.group] !== groupOrder[b.group]) {
                    return groupOrder[a.group] - groupOrder[b.group];
                  }
                  // 然后按分数排序
                  if (b.currentScore !== a.currentScore) {
                    return b.currentScore - a.currentScore;
                  }
                  // 最后按胜场数排序
                  return b.wins - a.wins;
                })
                .map((playerStat, index) => {
                  const player = tournament.players.find(
                    p => p._id.toString() === playerStat.playerId.toString()
                  );
                  return (
                    <TableRow key={playerStat.playerId}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{player?.name}</TableCell>
                      <TableCell>{player?.rank}</TableCell>
                      <TableCell>{playerStat.group}</TableCell>
                      <TableCell>{playerStat.currentScore.toFixed(1)}</TableCell>
                      <TableCell>{playerStat.wins}</TableCell>
                      <TableCell>{playerStat.losses}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ mt: 2 }}>
        <Button variant="contained" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </Box>
    </Box>
  );
};

export default TournamentResults;
