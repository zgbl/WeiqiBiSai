import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Paper,
  Grid,
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
  Stack,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  IconButton,
  Box,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
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
  const [existingPlayers, setExistingPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);

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

  const availablePlayers = existingPlayers.filter(player => 
    !tournament?.players?.some(tournamentPlayer => 
      tournamentPlayer._id === player._id
    )
  );

  useEffect(() => {
    setPage(0);
  }, [availablePlayers.length]);

  const handleAddPlayers = async () => {
    try {
      if (isNewPlayer) {
        if (!newPlayer.name || !newPlayer.rank) {
          setError('Name and rank are required');
          return;
        }
        const playerResponse = await axios.post('/api/tournaments/players', newPlayer);
        const newPlayerId = playerResponse.data._id;
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

  const handleDeletePlayer = async (playerId: string) => {
    try {
      await axios.delete(`/api/tournaments/${id}/players/${playerId}`);
      await fetchTournament();
      setSnackbarOpen(true);
    } catch (error: any) {
      console.error('Error removing player:', error);
      setError(error.response?.data?.message || 'Failed to remove player');
      setSnackbarOpen(true);
    }
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
            Add Players
          </Button>
          <StatusButton />
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Format</Typography>
            <Typography variant="h5">{tournament?.format}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Status</Typography>
            <Typography variant="h5">{tournament?.status}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Start Date</Typography>
            <Typography variant="h5">
              {new Date(tournament?.startDate || '').toLocaleDateString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>End Date</Typography>
            <Typography variant="h5">
              {new Date(tournament?.endDate || '').toLocaleDateString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Description</Typography>
            <Typography variant="h5">{tournament?.description}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ mt: 3, p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Tournament Players ({tournament?.players?.length || 0})
          </Typography>
          {tournament?.status === 'UPCOMING' && (
            <Button
              variant="contained"
              onClick={() => setOpenDialog(true)}
              startIcon={<AddIcon />}
            >
              Add Players
            </Button>
          )}
        </Box>

        <List>
          {tournament?.players?.map((player) => (
            <ListItem
              key={player._id}
              divider
              secondaryAction={
                tournament.status === 'UPCOMING' && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() => {
                      setPlayerToDelete(player._id);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    Remove
                  </Button>
                )
              }
            >
              <ListItemText
                primary={player.name}
                secondary={`Rank: ${player.rank}`}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Actions
        </Typography>
        {tournament?.status === 'UPCOMING' && (
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleStartTournament}
          >
            START TOURNAMENT
          </Button>
        )}
      </Paper>

      <Dialog 
        open={deleteConfirmOpen} 
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove this player from the tournament?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              if (playerToDelete) {
                handleDeletePlayer(playerToDelete);
                setDeleteConfirmOpen(false);
                setPlayerToDelete(null);
              }
            }}
            color="error"
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

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

      <Dialog
        open={addPlayerOpen}
        onClose={() => setAddPlayerOpen(false)}
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
          <Button onClick={() => setAddPlayerOpen(false)}>Cancel</Button>
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
