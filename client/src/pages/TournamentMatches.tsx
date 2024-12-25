import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  styled,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import { useSnackbar } from 'notistack';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: theme.spacing(1),
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  padding: theme.spacing(2),
  '&.rank-cell': {
    width: '100px',
  },
  '&.vs-cell': {
    width: '60px',
    textAlign: 'center',
  },
  '&.action-cell': {
    width: '150px',
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  minWidth: '120px',
  color: '#fff',
  backgroundColor: theme.palette.primary.main,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
  '&.next-round': {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));

interface Player {
  _id: string;
  name: string;
  rank: string;
}

interface Match {
  _id: string;
  player1: Player;
  player2: Player;
  winner?: Player;
  score?: {
    player1: number;
    player2: number;
  };
}

interface Round {
  roundNumber: number;
  matches: Match[];
  completed: boolean;
}

interface Tournament {
  _id: string;
  name: string;
  format: 'ROUNDROBIN' | 'SINGLEELIMINATION' | 'DOUBLEELIMINATION';
  rounds: Round[];
  status: string;
  players: Player[];
}

interface RecordResultDialogProps {
  open: boolean;
  onClose: () => void;
  match: Match | null;
  onSave: (winnerId: string) => void;
}

const RecordResultDialog = ({ open, onClose, match, onSave }: RecordResultDialogProps) => {
  const [winner, setWinner] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open) {
      setWinner('');
      setError('');
    }
  }, [open]);

  const handleSave = () => {
    if (!winner) {
      setError('Winner ID and result are required');
      enqueueSnackbar('Please select a winner', { variant: 'error' });
      return;
    }
    onSave(winner);
  };

  const players = [
    ...(match?.player1 ? [{ id: match.player1._id, name: match.player1.name }] : []),
    ...(match?.player2 ? [{ id: match.player2._id, name: match.player2.name }] : [])
  ];

  console.log('Available players:', players);
  console.log('Current winner:', winner);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Record Match Result</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="winner-select-label">Winner</InputLabel>
          <Select
            labelId="winner-select-label"
            value={winner}
            onChange={(e) => {
              console.log('Selected winner:', e.target.value);
              setWinner(e.target.value);
              setError('');
            }}
            label="Winner"
          >
            {players.map((player) => (
              <MenuItem key={player.id} value={player.id}>
                {player.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>CANCEL</Button>
        <Button onClick={handleSave} variant="contained">
          SAVE RESULT
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const TournamentMatches = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState<number | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const fetchTournament = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/tournaments/${id}`);
      console.log('Tournament response:', response.data);
      setTournament(response.data);
    } catch (error: any) {
      console.error('Error fetching tournament:', error);
      enqueueSnackbar('Failed to fetch tournament', { variant: 'error' });
    }
  };

  useEffect(() => {
    fetchTournament();
  }, [id]);

  const canGenerateNextRound = () => {
    if (!tournament) return false;
    const currentRound = tournament.rounds[tournament.rounds.length - 1];
    return currentRound && currentRound.matches.every(match => match.winner != null);
  };

  const handleEndTournament = () => {
    if (!tournament) {
      enqueueSnackbar('比赛数据未加载', { variant: 'error' });
      return;
    }

    console.log('Tournament data:', {
      id: tournament._id,
      name: tournament.name,
      format: tournament.format,
      status: tournament.status,
      rounds: tournament.rounds.length
    });

    let message = '比赛结束条件检查：\n\n';
    let canEnd = true;

    if (tournament.format === 'ROUNDROBIN') {
      // 1. 检查轮次数量
      const totalPlayers = tournament.players.length;
      const expectedRounds = totalPlayers - 1;
      const currentRounds = tournament.rounds.length;
      const roundsComplete = currentRounds >= expectedRounds;
      canEnd = canEnd && roundsComplete;
      
      message += `1. 轮次数量要求：${roundsComplete ? '✅' : '❌'}\n`;
      message += `   - 需要完成 ${expectedRounds} 轮比赛\n`;
      message += `   - 当前已完成 ${currentRounds} 轮\n`;
      message += `   - 结果：${roundsComplete ? '满足' : '不满足，还需要' + (expectedRounds - currentRounds) + '轮'}\n\n`;

      // 2. 检查每轮比赛是否都有结果
      const incompleteRounds = tournament.rounds
        .filter(round => round.matches.some(match => match.winner == null))
        .map(round => round.roundNumber);
      
      const allMatchesComplete = incompleteRounds.length === 0;
      canEnd = canEnd && allMatchesComplete;

      message += `2. 比赛结果记录要求：${allMatchesComplete ? '✅' : '❌'}\n`;
      message += `   - 需要：所有比赛都记录结果\n`;
      if (incompleteRounds.length > 0) {
        message += `   - 结果：不满足，第 ${incompleteRounds.join(', ')} 轮还有未记录的比赛\n`;
      } else {
        message += '   - 结果：满足，所有比赛都已记录结果\n';
      }

    } else if (tournament.format === 'SINGLEELIMINATION') {
      // 1. 检查是否已开始比赛
      const hasStarted = tournament.rounds.length > 0;
      canEnd = canEnd && hasStarted;
      
      message += `1. 比赛开始要求：${hasStarted ? '✅' : '❌'}\n`;
      message += `   - 需要：比赛已经开始\n`;
      message += `   - 当前：${hasStarted ? '已开始' : '未开始'}\n`;
      message += `   - 结果：${hasStarted ? '满足' : '不满足'}\n\n`;

      if (hasStarted) {
        // 2. 检查决赛是否完成
        const lastRound = tournament.rounds[tournament.rounds.length - 1];
        const incompleteMatches = lastRound.matches.filter(match => match.winner == null).length;
        const finalsComplete = incompleteMatches === 0;
        canEnd = canEnd && finalsComplete;

        message += `2. 决赛完成要求：${finalsComplete ? '✅' : '❌'}\n`;
        message += `   - 需要：决赛全部完成\n`;
        message += `   - 当前：${finalsComplete ? '已完成' : '还有 ' + incompleteMatches + ' 场比赛未完成'}\n`;
        message += `   - 结果：${finalsComplete ? '满足' : '不满足'}\n`;
      }
    } else {
      console.error('Unknown tournament format:', tournament.format);
      message += `❌ 错误：未知的比赛类型 (${tournament.format})\n`;
      message += '请联系管理员修复此问题';
      canEnd = false;
    }

    message += '\n结论：' + (canEnd ? '✅ 可以结束比赛' : '❌ 无法结束比赛，请满足以上所有条件');

    enqueueSnackbar(message, { 
      variant: canEnd ? 'success' : 'warning',
      autoHideDuration: 12000,
      style: { 
        whiteSpace: 'pre-line',
        maxWidth: '500px'
      }
    });

    if (canEnd) {
      navigate(`/tournament/${id}/results`);
    }
  };

  const handleGenerateNextRound = async () => {
    try {
      await axios.post(`/api/tournament/${id}/generate-next-round`);
      fetchTournament();
      enqueueSnackbar('Next round generated successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error generating next round:', error);
      enqueueSnackbar('Failed to generate next round', { variant: 'error' });
    }
  };

  const handleRecordResult = async (winnerId: string) => {
    if (!selectedMatch) {
      enqueueSnackbar('Match is required', { variant: 'error' });
      return;
    }

    if (!winnerId) {
      enqueueSnackbar('Winner ID is required', { variant: 'error' });
      return;
    }

    try {
      console.log('Recording result:', {
        tournamentId: id,
        matchId: selectedMatch._id,
        winnerId
      });

      const response = await axios.put(
        `http://localhost:3000/api/tournaments/${id}/matches/${selectedMatch._id}`,
        { winnerId }
      );

      console.log('Record result response:', response.data);
      enqueueSnackbar('Match result recorded successfully', { variant: 'success' });

      setOpenDialog(false);
      setSelectedMatch(null);
      fetchTournament();
    } catch (error: any) {
      console.error('Error recording match result:', error);
      const errorMessage = error.response?.data?.message || 'Failed to record match result';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  const handleDeleteRound = async (roundNumber: number) => {
    try {
      await axios.delete(`http://localhost:3000/api/tournaments/${id}/rounds/${roundNumber}`);
      fetchTournament();
    } catch (error: any) {
      console.error('Error deleting round:', error);
      enqueueSnackbar('Failed to delete round', { variant: 'error' });
    }
  };

  if (!tournament) {
    return <Typography>Loading...</Typography>;
  }

  const currentRound = tournament.rounds[tournament.rounds.length - 1];
  const isRoundComplete = currentRound?.matches.every(match => match.winner);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {tournament.name} - Matches
      </Typography>

      {tournament && (
        <>
          {tournament.rounds.map((round, index) => (
            <Paper key={index} sx={{ mb: 3, p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ color: 'primary.main' }}>
                  Round {round.roundNumber}
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    setRoundToDelete(round.roundNumber);
                    setDeleteDialogOpen(true);
                  }}
                  startIcon={<DeleteIcon />}
                >
                  Delete Round
                </Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <StyledTableCell>Player 1</StyledTableCell>
                      <StyledTableCell className="rank-cell">Rank</StyledTableCell>
                      <StyledTableCell className="vs-cell">vs</StyledTableCell>
                      <StyledTableCell>Player 2</StyledTableCell>
                      <StyledTableCell className="rank-cell">Rank</StyledTableCell>
                      <StyledTableCell>Winner</StyledTableCell>
                      <StyledTableCell className="action-cell">Action</StyledTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {round.matches.map((match) => {
                      console.log('Rendering match:', match);
                      return (
                        <TableRow key={match._id} sx={{ '&:hover': { backgroundColor: 'rgba(0,0,0,0.02)' } }}>
                          <StyledTableCell>{match.player1?.name || 'Bye'}</StyledTableCell>
                          <StyledTableCell className="rank-cell">{match.player1?.rank || '-'}</StyledTableCell>
                          <StyledTableCell className="vs-cell">vs</StyledTableCell>
                          <StyledTableCell>{match.player2?.name || 'Bye'}</StyledTableCell>
                          <StyledTableCell className="rank-cell">{match.player2?.rank || '-'}</StyledTableCell>
                          <StyledTableCell>
                            {match.winner ? match.winner.name : '-'}
                          </StyledTableCell>
                          <StyledTableCell className="action-cell">
                            {!match.winner && (
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => {
                                  setSelectedMatch(match);
                                  setOpenDialog(true);
                                }}
                              >
                                Record Result
                              </Button>
                            )}
                          </StyledTableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ))}

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            {isRoundComplete && tournament.status !== 'completed' && (
              <Button
                variant="contained"
                onClick={handleGenerateNextRound}
                disabled={!canGenerateNextRound()}
              >
                Generate Next Round
              </Button>
            )}

            <Button
              variant="contained"
              color="success"
              onClick={handleEndTournament}
              sx={{ ml: 2 }}
            >
              End Tournament
            </Button>
          </Box>
        </>
      )}

      <RecordResultDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        match={selectedMatch}
        onSave={handleRecordResult}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Round {roundToDelete}
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete round {roundToDelete} and all subsequent rounds? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (roundToDelete) {
                handleDeleteRound(roundToDelete);
                setDeleteDialogOpen(false);
              }
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TournamentMatches;