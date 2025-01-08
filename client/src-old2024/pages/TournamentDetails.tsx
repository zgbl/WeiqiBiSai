import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Grid,
  Paper,
  Box,
  List,
  ListItem,
  ListItemText,
  Stack,
  Snackbar,
  Alert,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  TablePagination
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import { TournamentStatus, Tournament, Player, TournamentFormat } from '../types/tournament';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const TournamentDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [openPlayerDialog, setOpenPlayerDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState<string | null>(null);

  const canAddPlayers = tournament?.status === TournamentStatus.PENDING;

  const fetchTournament = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/tournaments/${id}`);
      if (response.data) {
        console.log('Tournament data:', response.data);
        setTournament(response.data);
      } else {
        setError('No tournament data received');
      }
    } catch (error) {
      console.error('Error fetching tournament:', error);
      setError('Failed to fetch tournament data');
    }
  };

  const fetchPlayers = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/players');
      if (response.data) {
        console.log('Players data:', response.data);
        setPlayers(response.data);
      } else {
        console.error('No players data received');
      }
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const fetchAllPlayers = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/players');
      if (response.data) {
        console.log('All players data:', response.data);
        setAllPlayers(response.data);
      } else {
        console.error('No players data received');
      }
    } catch (err: any) {
      console.error('Error fetching players:', err);
      setError(err.response?.data?.message || 'Failed to fetch players');
    }
  };

  useEffect(() => {
    fetchTournament();
  }, [id]);

  useEffect(() => {
    if (openDialog) {
      fetchPlayers();
    }
  }, [openDialog]);

  useEffect(() => {
    fetchAllPlayers();
  }, []);

  useEffect(() => {
    if (tournament) {
      console.log('Tournament status:', tournament.status);
      console.log('Can add players:', canAddPlayers);
    }
  }, [tournament, canAddPlayers]);

  const handleAddPlayer = async () => {
    try {
      if (!selectedPlayer) {
        setError('Please select a player');
        return;
      }

      if (!id) {
        setError('Tournament ID is missing');
        return;
      }

      console.log('Adding player:', {
        tournamentId: id,
        playerId: selectedPlayer,
        requestUrl: `http://localhost:3000/api/tournaments/${id}/players`
      });

      const response = await axios.post(
        `http://localhost:3000/api/tournaments/${id}/players`,
        { playerId: selectedPlayer }
      );

      console.log('Add player response:', response.data);
      setTournament(response.data);
      setOpenDialog(false);
      setSelectedPlayer('');
      setError('Player added successfully!');
    } catch (error: any) {
      console.error('Error adding player:', error.response?.data);
      const errorMessage = error.response?.data?.message || 'Failed to add player';
      setError(errorMessage);
    }
  };

  const handlePlayerSelect = (event: any) => {
    const value = event.target.value;
    console.log('Selected player:', value);
    setSelectedPlayer(value);
    setError('');
  };

  const handleStartTournament = async () => {
    try {
      console.log('Starting tournament:', id);
      const response = await axios.post(`http://localhost:3000/api/tournaments/${id}/start`);
      console.log('Tournament started:', response.data);
      setTournament(response.data);
      setError('Tournament started successfully!');
      navigate(`/tournament/${id}/matches`);
    } catch (error: any) {
      console.error('Error starting tournament:', error);
      const errorMessage = error.response?.data?.message || 'Failed to start tournament';
      setError(errorMessage);
    }
  };

  const handleDeleteTournament = async () => {
    try {
      await axios.delete(`http://localhost:3000/api/tournaments/${id}`);
      navigate('/');
      setError('Tournament deleted successfully');
    } catch (error: any) {
      console.error('Error deleting tournament:', error);
      setError(error.response?.data?.message || 'Failed to delete tournament');
    }
  };

  const handleDeleteCurrentRound = async () => {
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      console.log('Deleting current round');
      const response = await axios.delete(`http://localhost:3000/api/tournaments/${id}/rounds/current`);
      console.log('Round deleted:', response.data);
      setTournament(response.data);
      setError('Current round deleted successfully');
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      console.error('Error deleting round:', error);
      setError(error.response?.data?.message || 'Failed to delete round');
    }
  };

  const handleFormatChange = async (newFormat: TournamentFormat) => {
    try {
      console.log('Updating tournament format to:', newFormat);
      
      const response = await axios.put(`http://localhost:3000/api/tournaments/${id}`, {
        format: newFormat
      });
      
      console.log('Tournament updated:', response.data);
      setTournament(response.data);
      setError('Tournament format updated successfully');
    } catch (error: any) {
      console.error('Error updating tournament format:', error);
      setError(error.response?.data?.message || 'Failed to update tournament format');
    }
  };

  const handleAddPlayers = async () => {
    try {
      // Send all selected players in a single request
      await axios.post(`http://localhost:3000/api/tournaments/${tournament._id}/players`, {
        playerIds: selectedPlayers
      });
      
      await fetchTournament();
      setOpenPlayerDialog(false);
      setSelectedPlayers([]);
      setError('Players added successfully');
    } catch (err: any) {
      console.error('Error adding players:', err);
      setError(err.response?.data?.message || 'Failed to add players');
    }
  };

  const deleteRound = async (roundNumber: number) => {
    try {
      await axios.delete(`http://localhost:3000/api/tournaments/${id}/rounds/${roundNumber}`);
      fetchTournament();  // Refresh the tournament data
    } catch (error) {
      console.error('Error deleting round:', error);
    }
  };

  const renderMatch = (match: any, roundIndex: number) => {
    // 如果是轮空，显示特殊标记
    if (match.result === 'BYE') {
      return (
        <Paper key={`bye-${match._id}`} sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}>
              <Typography align="center">
                {match.player1?.name || 'TBD'} (轮空)
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      );
    }

    return (
      <Paper key={`match-${match._id}`} sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={5}>
            <Typography>
              {match.player1?.name || 'TBD'} {match.player1?.rank && `| ${match.player1.rank}`} | Group: {match.player1?.group || 'N/A'} | Score: 0
              {match.winner && match.winner._id === match.player1?._id && (
                <Typography component="span" color="primary" sx={{ ml: 1 }}>
                  (Winner)
                </Typography>
              )}
            </Typography>
          </Grid>
          <Grid item xs={2} sx={{ textAlign: 'center' }}>
            <Typography variant="h6">vs</Typography>
          </Grid>
          <Grid item xs={5}>
            <Typography>
              {match.player2?.name || 'TBD'} {match.player2?.rank && `| ${match.player2.rank}`} | Group: {match.player2?.group || 'N/A'} | Score: 0
              {match.winner && match.winner._id === match.player2?._id && (
                <Typography component="span" color="primary" sx={{ ml: 1 }}>
                  (Winner)
                </Typography>
              )}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    );
  };

  const handleDeletePlayer = async (playerId: string) => {
    try {
      await axios.delete(`/api/tournaments/${tournament._id}/players/${playerId}`);
      fetchTournament(); // 重新加载比赛数据
    } catch (error) {
      console.error('Error deleting player:', error);
      setError('删除选手失败');
    }
  };

  const renderPlayerActions = (player: any) => (
    <Box>
      <IconButton
        color="error"
        onClick={() => handleDeletePlayer(player._id)}
        disabled={tournament?.status !== TournamentStatus.PENDING}
      >
        <DeleteIcon />
      </IconButton>
    </Box>
  );

  const handleDeleteClick = (tournamentId: string) => {
    setTournamentToDelete(tournamentId);
    setOpenDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (tournamentToDelete) {
      try {
        await axios.delete(`/api/tournaments/${tournamentToDelete}`);
        navigate('/tournaments');
      } catch (error) {
        console.error('Error deleting tournament:', error);
      }
    }
    setOpenDeleteDialog(false);
  };

  const handleDeleteCancel = () => {
    setTournamentToDelete(null);
    setOpenDeleteDialog(false);
  };

  return (
    <Box sx={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <Grid container spacing={3}>
        {/* 左侧面板：比赛信息和操作按钮 */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom>
              Tournament Controls
            </Typography>
            
            <Stack spacing={2}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => setOpenPlayerDialog(true)}
                disabled={!canAddPlayers}
              >
                Add Players
              </Button>

              {tournament?.status === TournamentStatus.PENDING && (
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleStartTournament}
                >
                  Start Tournament
                </Button>
              )}

              {tournament?.status === TournamentStatus.ONGOING && (
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    try {
                      await axios.post(`http://localhost:3000/api/tournaments/${tournament._id}/rounds`);
                      await fetchTournament();
                      setError('Next round generated successfully');
                    } catch (err: any) {
                      setError(err.response?.data?.message || 'Failed to generate next round');
                    }
                  }}
                >
                  Generate Next Round
                </Button>
              )}

              <Button
                fullWidth
                variant="contained"
                color="error"
                onClick={() => handleDeleteClick(tournament._id)}
                sx={{ mt: 2 }}
              >
                删除比赛
              </Button>
            </Stack>

            <Box sx={{ mt: 3 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Tournament Format</InputLabel>
                <Select
                  value={tournament?.format || ''}
                  onChange={(e) => handleFormatChange(e.target.value as TournamentFormat)}
                  disabled={tournament?.status !== TournamentStatus.PENDING}
                >
                  <MenuItem value={TournamentFormat.MCMAHON}>McMahon</MenuItem>
                  <MenuItem value={TournamentFormat.SINGLEELIMINATION}>Single Elimination</MenuItem>
                  <MenuItem value={TournamentFormat.SWISS}>Swiss</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="body1" color="textSecondary">
                Status: {tournament?.status}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Players: {tournament?.players.length || 0}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* 右侧面板：选手列表和轮次信息 */}
        <Grid item xs={12} md={8}>
          {/* 选手列表 */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Players
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>姓名</TableCell>
                    <TableCell>段位</TableCell>
                    <TableCell>组别</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tournament?.players?.map((player: any, index: number) => (
                    <TableRow key={`player-${player._id}-${index}`}>
                      <TableCell>{player.name}</TableCell>
                      <TableCell>{player.rank}</TableCell>
                      <TableCell>{player.group}</TableCell>
                      <TableCell>{renderPlayerActions(player)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* 轮次信息 */}
          {tournament?.rounds && tournament.rounds.map((round: any, index: number) => (
            <Paper key={`round-${round.roundNumber}`} sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Round {round.roundNumber}
                </Typography>
                <IconButton
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this round?')) {
                      deleteRound(round.roundNumber);
                    }
                  }}
                  color="error"
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>

              <Grid container spacing={2}>
                {round.matches && round.matches.map((match: any) => (
                  <Grid item xs={12} sm={6} key={`match-${match._id}-${round.roundNumber}`}>
                    {renderMatch(match, index)}
                  </Grid>
                ))}
              </Grid>
            </Paper>
          ))}
        </Grid>
      </Grid>

      {/* 添加选手对话框 */}
      <Dialog open={openPlayerDialog} onClose={() => setOpenPlayerDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Players</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedPlayers.length > 0 && selectedPlayers.length < allPlayers.length}
                      checked={selectedPlayers.length === allPlayers.length}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedPlayers(allPlayers.map(player => player._id));
                        } else {
                          setSelectedPlayers([]);
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Rank</TableCell>
                  <TableCell>Rating</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allPlayers
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((player, index) => (
                    <TableRow key={`player-${player._id}-${index}`}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedPlayers.includes(player._id)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedPlayers([...selectedPlayers, player._id]);
                            } else {
                              setSelectedPlayers(selectedPlayers.filter(id => id !== player._id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>{player.name}</TableCell>
                      <TableCell>{player.rank}</TableCell>
                      <TableCell>{player.rating}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={allPlayers.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPlayerDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddPlayers}
            variant="contained" 
            color="primary"
            disabled={selectedPlayers.length === 0}
          >
            Add Selected Players ({selectedPlayers.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Current Round</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openDeleteDialog}
        onClose={handleDeleteCancel}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"确认删除比赛？"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            此操作将永久删除该比赛及其所有相关数据，此操作不可撤销。确定要继续吗？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>取消</Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      {error && (
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setError('')} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
};

export default TournamentDetails;
