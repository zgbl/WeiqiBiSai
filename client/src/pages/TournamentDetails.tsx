import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Paper,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Stack,
} from '@mui/material';
import axios from 'axios';

interface Tournament {
  _id: string;
  name: string;
  format: string;
  startDate: string;
  endDate: string;
  status: string;
  description?: string;
  players?: Array<{
    _id: string;
    name: string;
    rank: string;
  }>;
}

interface Player {
  _id: string;
  name: string;
  rank: string;
}

enum TournamentStatus {
  UPCOMING = 'UPCOMING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
}

const TournamentDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', rank: '' });
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [existingPlayers, setExistingPlayers] = useState<Player[]>([]);
  const [selectedExistingPlayer, setSelectedExistingPlayer] = useState<string>('');
  const [isNewPlayer, setIsNewPlayer] = useState(true);
  const navigate = useNavigate();

  const fetchTournament = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/tournaments/${id}`);
      console.log('Tournament data:', response.data);
      setTournament(response.data);
    } catch (error) {
      console.error('Error fetching tournament:', error);
      setError('Failed to fetch tournament data');
      setSnackbarOpen(true);
    }
  };

  const fetchExistingPlayers = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/tournaments/players');
      setExistingPlayers(response.data);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  useEffect(() => {
    if (id) {
      fetchTournament();
    }
  }, [id]);

  useEffect(() => {
    if (openDialog) {
      fetchExistingPlayers();
    }
  }, [openDialog]);

  const handleAddPlayer = async () => {
    try {
      setError('');
      if (isNewPlayer) {
        if (!newPlayer.name || !newPlayer.rank) {
          setError('Name and rank are required');
          return;
        }
        await axios.post(`http://localhost:3000/api/tournaments/${id}/players`, newPlayer);
      } else {
        if (!selectedExistingPlayer) {
          setError('Please select a player');
          return;
        }
        const player = existingPlayers.find(p => p._id === selectedExistingPlayer);
        if (!player) {
          setError('Selected player not found');
          return;
        }
        await axios.post(`http://localhost:3000/api/tournaments/${id}/players`, {
          playerId: selectedExistingPlayer
        });
      }
      
      setOpenDialog(false);
      setNewPlayer({ name: '', rank: '' });
      setSelectedExistingPlayer('');
      fetchTournament();
    } catch (error: any) {
      console.error('Error adding player:', error);
      setError(error.response?.data?.message || 'Failed to add player');
    }
  };

  const handleStartTournament = async () => {
    try {
      if (!tournament?.players || tournament.players.length < 2) {
        setError('Need at least 2 players to start the tournament');
        return;
      }

      // Start the tournament and generate first round
      await axios.post(`http://localhost:3000/api/tournaments/${id}/rounds`);
      
      // Refresh tournament data
      await fetchTournament();
      
      // Navigate to matches view
      navigate(`/tournament/${id}/matches`);
    } catch (error: any) {
      console.error('Error starting tournament:', error);
      setError(error.response?.data?.message || 'Failed to start tournament');
      // Show error in a Snackbar or alert
      setSnackbarOpen(true);
    }
  };

  const StatusButton = () => {
    if (!tournament) return null;

    switch (tournament.status) {
      case 'UPCOMING':
        return (
          <Button
            variant="contained"
            color="primary"
            onClick={handleStartTournament}
            disabled={tournament.players.length < 2}
          >
            Start Tournament
          </Button>
        );
      case 'ONGOING':
        return (
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/tournament/${id}/matches`)}
          >
            View Matches
          </Button>
        );
      case 'COMPLETED':
        return (
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/tournament/${id}/matches`)}
          >
            View Results
          </Button>
        );
      default:
        return null;
    }
  };

  if (!tournament) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          {tournament.name}
        </Typography>
        <Box>
          <Button
            variant="outlined"
            onClick={() => setOpenDialog(true)}
            sx={{ mr: 2 }}
          >
            Add Player
          </Button>
          <StatusButton />
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Tournament Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography color="textSecondary">Format</Typography>
                <Typography variant="body1">{tournament.format}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Status</Typography>
                <Typography variant="body1">{tournament.status}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Start Date</Typography>
                <Typography variant="body1">
                  {new Date(tournament.startDate).toLocaleDateString()}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">End Date</Typography>
                <Typography variant="body1">
                  {new Date(tournament.endDate).toLocaleDateString()}
                </Typography>
              </Grid>
            </Grid>
            {tournament.description && (
              <Box mt={2}>
                <Typography color="textSecondary">Description</Typography>
                <Typography variant="body1">{tournament.description}</Typography>
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Players
            </Typography>
            <List>
              {tournament.players && tournament.players.length > 0 ? (
                tournament.players.map((player) => (
                  <div key={player._id}>
                    <ListItem>
                      <ListItemText
                        primary={player.name}
                        secondary={`Rank: ${player.rank}`}
                      />
                    </ListItem>
                    <Divider />
                  </div>
                ))
              ) : (
                <Typography color="textSecondary" sx={{ p: 2 }}>
                  No players have joined this tournament yet.
                </Typography>
              )}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, position: 'relative' }}>
            <Typography variant="h6" gutterBottom>
              Actions
            </Typography>
            {tournament && (
              <>
                <pre style={{ fontSize: '12px', color: '#666' }}>
                  {JSON.stringify({ status: tournament.status }, null, 2)}
                </pre>
                <Stack spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
                  {tournament.status.toUpperCase() === 'UPCOMING' && (
                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: '#1565c0'
                        },
                        zIndex: 2
                      }}
                      onClick={async () => {
                        console.log('Starting tournament...');
                        try {
                          await axios.post(`http://localhost:3000/api/tournaments/${tournament._id}/rounds`);
                          await fetchTournament();
                        } catch (error: any) {
                          console.error('Error starting tournament:', error);
                          setError(error.response?.data?.message || 'Failed to start tournament');
                          setSnackbarOpen(true);
                        }
                      }}
                    >
                      Start Tournament
                    </Button>
                  )}
                  
                  {tournament.status.toUpperCase() === 'ONGOING' && (
                    <>
                      <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: '#1565c0'
                          },
                          zIndex: 2
                        }}
                        onClick={() => {
                          console.log('Navigating to matches...');
                          navigate(`/tournament/${tournament._id}/matches`);
                        }}
                      >
                        Manage Rounds
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        color="primary"
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'rgba(25, 118, 210, 0.04)'
                          },
                          zIndex: 2
                        }}
                        onClick={async () => {
                          console.log('Generating next round...');
                          try {
                            await axios.post(`http://localhost:3000/api/tournaments/${tournament._id}/rounds`);
                            await fetchTournament();
                          } catch (error: any) {
                            console.error('Error generating next round:', error);
                            setError(error.response?.data?.message || 'Failed to generate next round');
                            setSnackbarOpen(true);
                          }
                        }}
                      >
                        Generate Next Round
                      </Button>
                    </>
                  )}

                  {tournament.status.toUpperCase() === 'COMPLETED' && (
                    <Button
                      fullWidth
                      variant="outlined"
                      color="primary"
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'rgba(25, 118, 210, 0.04)'
                        },
                        zIndex: 2
                      }}
                      onClick={() => {
                        console.log('Viewing results...');
                        navigate(`/tournament/${tournament._id}/matches`);
                      }}
                    >
                      View Results
                    </Button>
                  )}
                </Stack>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Add Player</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2, mt: 2 }}>
            <InputLabel>Player Type</InputLabel>
            <Select
              value={isNewPlayer ? 'new' : 'existing'}
              onChange={(e) => {
                setIsNewPlayer(e.target.value === 'new');
                setError('');
              }}
            >
              <MenuItem value="new">New Player</MenuItem>
              <MenuItem value="existing">Existing Player</MenuItem>
            </Select>
          </FormControl>

          {isNewPlayer ? (
            <>
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
            </>
          ) : (
            <FormControl fullWidth>
              <InputLabel>Select Player</InputLabel>
              <Select
                value={selectedExistingPlayer}
                onChange={(e) => setSelectedExistingPlayer(e.target.value)}
              >
                {existingPlayers.map((player) => (
                  <MenuItem key={player._id} value={player._id}>
                    {player.name} ({player.rank})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleAddPlayer}>Add</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={error}
        sx={{ zIndex: 9999 }}
      />
    </div>
  );
};

export default TournamentDetails;
