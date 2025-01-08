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
  Checkbox
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
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [isNewPlayer, setIsNewPlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', rank: '' });
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [existingPlayers, setExistingPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);

  // 过滤掉已经添加的选手
  const availablePlayers = existingPlayers.filter(player => 
    !tournament?.players?.some(tournamentPlayer => 
      tournamentPlayer._id === player._id
    )
  );

  useEffect(() => {
    setPage(0);
  }, [availablePlayers.length]);

  const fetchTournament = async () => {
    try {
      const response = await axios.get(`/api/tournaments/${id}`);
      console.log('Tournament data:', response.data);
      if (response.data && response.data.players) {
        console.log('Players:', response.data.players);
      }
      setTournament(response.data);
    } catch (error) {
      console.error('Error fetching tournament:', error);
      setError('Failed to fetch tournament data');
      setSnackbarOpen(true);
    }
  };

  const fetchExistingPlayers = async () => {
    try {
      const response = await axios.get('/api/tournaments/players');
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

  const handleAddPlayers = async () => {
    try {
      if (isNewPlayer) {
        if (!newPlayer.name || !newPlayer.rank) {
          setError('Name and rank are required');
          return;
        }
        const response = await axios.post('/api/players', newPlayer);
        const newPlayerId = response.data._id;
        await axios.post(`/api/tournaments/${id}/players`, {
          playerId: newPlayerId
        });
      } else {
        if (selectedPlayers.length === 0) {
          setError('Please select at least one player');
          return;
        }
        // 批量添加选中的选手
        for (const playerId of selectedPlayers) {
          await axios.post(`/api/tournaments/${id}/players`, {
            playerId: playerId
          });
        }
      }
      await fetchTournament();
      setOpenDialog(false);
      setNewPlayer({ name: '', rank: '' });
      setSelectedPlayers([]);
      setError('');
    } catch (error: any) {
      console.error('Error adding player:', error);
      setError(error.response?.data?.message || 'Failed to add player');
    }
  };

  const handlePlayerSelect = (playerId: string) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
  };

  const handleSelectAllInPage = (checked: boolean) => {
    const startIndex = page * rowsPerPage;
    const endIndex = Math.min((page + 1) * rowsPerPage, availablePlayers.length);
    const currentPagePlayers = availablePlayers.slice(startIndex, endIndex);
    
    if (checked) {
      const newSelected = [...selectedPlayers];
      currentPagePlayers.forEach(player => {
        if (!newSelected.includes(player._id)) {
          newSelected.push(player._id);
        }
      });
      setSelectedPlayers(newSelected);
    } else {
      const currentPageIds = currentPagePlayers.map(player => player._id);
      setSelectedPlayers(prev => prev.filter(id => !currentPageIds.includes(id)));
    }
  };

  const isAllInPageSelected = () => {
    const startIndex = page * rowsPerPage;
    const endIndex = Math.min((page + 1) * rowsPerPage, availablePlayers.length);
    const currentPagePlayers = availablePlayers.slice(startIndex, endIndex);
    return currentPagePlayers.length > 0 && 
           currentPagePlayers.every(player => selectedPlayers.includes(player._id));
  };

  const handleStartTournament = async () => {
    try {
      if (!tournament?.players || tournament.players.length < 2) {
        setError('Need at least 2 players to start the tournament');
        return;
      }

      await axios.post(`/api/tournaments/${id}/rounds`);
      await fetchTournament();
      navigate(`/tournament/${id}/matches`);
    } catch (error: any) {
      console.error('Error starting tournament:', error);
      setError(error.response?.data?.message || 'Failed to start tournament');
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
                tournament.players.map((player, index) => (
                  <div key={`player-${player._id}-${index}`}>
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
                          await axios.post(`/api/tournaments/${tournament._id}/rounds`);
                          console.log('Tournament ID is:', tournament._id);
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
                            await axios.post(`/api/tournaments/${tournament._id}/rounds`);
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

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Players</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2, mt: 2 }}>
            <InputLabel>Player Type</InputLabel>
            <Select
              value={isNewPlayer ? 'new' : 'existing'}
              onChange={(e) => {
                setIsNewPlayer(e.target.value === 'new');
                setError('');
                setSelectedPlayers([]);
                setPage(0);
              }}
            >
              <MenuItem value="new">New Player</MenuItem>
              <MenuItem value="existing">Existing Players</MenuItem>
            </Select>
          </FormControl>

          {isNewPlayer ? (
            <>
              <TextField
                fullWidth
                label="Name"
                value={newPlayer.name}
                onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Rank"
                value={newPlayer.rank}
                onChange={(e) => setNewPlayer({ ...newPlayer, rank: e.target.value })}
              />
            </>
          ) : (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Checkbox
                  checked={isAllInPageSelected()}
                  onChange={(e) => handleSelectAllInPage(e.target.checked)}
                />
                <Typography>Select All on This Page</Typography>
              </Box>
              {availablePlayers.length === 0 ? (
                <Typography sx={{ textAlign: 'center', py: 3 }}>
                  No available players to add
                </Typography>
              ) : (
                <>
                  <List sx={{ minHeight: 500, maxHeight: 500, overflow: 'auto' }}>
                    {availablePlayers
                      .slice(page * rowsPerPage, (page + 1) * rowsPerPage)
                      .map((player) => (
                        <ListItem 
                          key={player._id} 
                          divider
                        >
                          <Checkbox
                            checked={selectedPlayers.includes(player._id)}
                            onChange={() => handlePlayerSelect(player._id)}
                          />
                          <ListItemText 
                            primary={player.name}
                            secondary={`Rank: ${player.rank}`}
                          />
                        </ListItem>
                      ))}
                  </List>
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    mt: 2,
                    gap: 2
                  }}>
                    <Button
                      disabled={page === 0}
                      onClick={() => setPage(prev => prev - 1)}
                    >
                      Previous
                    </Button>
                    <Typography sx={{ alignSelf: 'center' }}>
                      Page {page + 1} of {Math.ceil(availablePlayers.length / rowsPerPage)}
                    </Typography>
                    <Button
                      disabled={page >= Math.ceil(availablePlayers.length / rowsPerPage) - 1}
                      onClick={() => setPage(prev => prev + 1)}
                    >
                      Next
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          )}

          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddPlayers}
            variant="contained" 
            color="primary"
            disabled={isNewPlayer ? !newPlayer.name || !newPlayer.rank : selectedPlayers.length === 0}
          >
            {isNewPlayer ? 'Add Player' : `Add Selected Players (${selectedPlayers.length})`}
          </Button>
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
