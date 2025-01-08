import { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  IconButton,
  Snackbar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

interface Player {
  _id: string;
  name: string;
  rank: string;
  rating?: number;
  wins: number;
  losses: number;
  draws: number;
}

const Players = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', rank: '' });
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const fetchPlayers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/tournaments/players`);
      setPlayers(response.data);
    } catch (error) {
      console.error('Error fetching players:', error);
      setSnackbarMessage('Failed to fetch players');
      setSnackbarOpen(true);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleAddPlayer = async () => {
    try {
      setError('');
      if (!newPlayer.name || !newPlayer.rank) {
        setError('Name and rank are required');
        return;
      }

      await axios.post(`${API_BASE_URL}/tournaments/players`, newPlayer);
      setOpenDialog(false);
      setNewPlayer({ name: '', rank: '' });
      fetchPlayers();
      setSnackbarMessage('Player added successfully');
      setSnackbarOpen(true);
    } catch (error: any) {
      console.error('Error adding player:', error);
      setError(error.response?.data?.message || 'Failed to add player');
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/tournaments/players/${playerId}`);
      fetchPlayers();
      setSnackbarMessage('Player deleted successfully');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error deleting player:', error);
      setSnackbarMessage('Failed to delete player');
      setSnackbarOpen(true);
    }
  };

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Players
        </Typography>
        <Button variant="contained" onClick={() => setOpenDialog(true)}>
          Add Player
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Rank</TableCell>
              <TableCell>Rating</TableCell>
              <TableCell>Win/Loss/Draw</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player._id}>
                <TableCell>{player.name}</TableCell>
                <TableCell>{player.rank}</TableCell>
                <TableCell>{player.rating || 'N/A'}</TableCell>
                <TableCell>{`${player.wins}/${player.losses}/${player.draws}`}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleDeletePlayer(player._id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Add New Player</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Player Name"
              value={newPlayer.name}
              onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth>
              <InputLabel>Rank</InputLabel>
              <Select
                value={newPlayer.rank}
                label="Rank"
                onChange={(e) => setNewPlayer({ ...newPlayer, rank: e.target.value })}
              >
                {[...Array(9)].map((_, i) => (
                  <MenuItem key={`${i + 1}d`} value={`${i + 1}d`}>{i + 1}d</MenuItem>
                ))}
                {[...Array(30)].map((_, i) => (
                  <MenuItem key={`${i + 1}k`} value={`${i + 1}k`}>{i + 1}k</MenuItem>
                ))}
              </Select>
            </FormControl>
            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleAddPlayer} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </div>
  );
};

export default Players;