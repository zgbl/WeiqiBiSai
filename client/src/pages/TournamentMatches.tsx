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
  CircularProgress,
  IconButton,
  Grid,
  Card,
  CardContent
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
  score: number;
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
  format: 'ROUNDROBIN' | 'SINGLEELIMINATION' | 'DOUBLEELIMINATION' | 'SWISS';
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
    if (open && match) {
      // 重置状态
      setWinner('');
      setError('');
    }
  }, [open, match]);

  if (!match) {
    return null;
  }

  const players = [
    { id: match.player1?._id || '', name: match.player1?.name || 'TBD' },
    { id: match.player2?._id || '', name: match.player2?.name || 'TBD' }
  ].filter(player => player.id !== '');

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
        <Button 
          onClick={() => {
            if (!winner) {
              setError('Please select a winner');
              return;
            }
            onSave(winner);
          }} 
          variant="contained"
        >
          SAVE RESULT
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ResultsTable = ({ results }: { results: any[] }) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Rank</TableCell>
          <TableCell>Player</TableCell>
          <TableCell align="right">Score</TableCell>
          <TableCell align="right">Game Points</TableCell>
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
            <TableCell align="right">{result.gamePoints > 0 ? `+${result.gamePoints}` : result.gamePoints}</TableCell>
            <TableCell align="right">{result.wins}</TableCell>
            <TableCell align="right">{result.losses}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

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
      const response = await axios.get(`/api/tournaments/${id}`);
      console.log('Tournament response:', response.data);
      setTournament(response.data);
    } catch (error) {
      console.error('Error fetching tournament:', error);
      enqueueSnackbar('Failed to load tournament data', { variant: 'error' });
    }
  };

  useEffect(() => {
    fetchTournament();
  }, [id]);

  if (!tournament) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  const currentRoundNumber = tournament.rounds?.length || 0;
  const currentRound = tournament.rounds?.[currentRoundNumber - 1];
  
  // 检查当前轮次是否所有比赛都有结果
  const isLastRoundComplete = currentRound?.matches?.every(match => match.winner != null) || false;
  
  // 只有在当前轮次完成后才能生成下一轮
  const canGenerateNextRound = tournament.status === 'ONGOING' && currentRound && isLastRoundComplete;

  console.log('Tournament state:', {
    currentRoundNumber,
    currentRound,
    isLastRoundComplete,
    canGenerateNextRound,
    roundMatches: currentRound?.matches,
    tournamentStatus: tournament.status
  });

  const canEnd = tournament.rounds?.every(round => round.completed) || false;

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
    let canEndTournament = true;

    if (tournament.format === 'ROUNDROBIN') {
      // 1. 检查轮次数量
      const totalPlayers = tournament.players.length;
      const expectedRounds = totalPlayers - 1;
      const currentRounds = tournament.rounds.length;
      const roundsComplete = currentRounds >= expectedRounds;
      canEndTournament = canEndTournament && roundsComplete;
      
      message += `1. 轮次数量要求：${roundsComplete ? '✅' : '❌'}\n`;
      message += `   - 需要完成 ${expectedRounds} 轮比赛\n`;
      message += `   - 当前已完成 ${currentRounds} 轮\n`;
      message += `   - 结果：${roundsComplete ? '满足' : '不满足，还需要' + (expectedRounds - currentRounds) + '轮'}\n\n`;

      // 2. 检查每轮比赛是否都有结果
      const incompleteRounds = tournament.rounds
        .filter(round => round.matches.some(match => match.winner == null))
        .map(round => round.roundNumber);
      
      const allMatchesComplete = incompleteRounds.length === 0;
      canEndTournament = canEndTournament && allMatchesComplete;

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
      canEndTournament = canEndTournament && hasStarted;
      
      message += `1. 比赛开始要求：${hasStarted ? '✅' : '❌'}\n`;
      message += `   - 需要：比赛已经开始\n`;
      message += `   - 当前：${hasStarted ? '已开始' : '未开始'}\n`;
      message += `   - 结果：${hasStarted ? '满足' : '不满足'}\n\n`;

      if (hasStarted) {
        // 2. 检查决赛是否完成
        const lastRound = tournament.rounds[tournament.rounds.length - 1];
        const incompleteMatches = lastRound.matches.filter(match => match.winner == null).length;
        const finalsComplete = incompleteMatches === 0;
        canEndTournament = canEndTournament && finalsComplete;

        message += `2. 决赛完成要求：${finalsComplete ? '✅' : '❌'}\n`;
        message += `   - 需要：决赛全部完成\n`;
        message += `   - 当前：${finalsComplete ? '已完成' : '还有 ' + incompleteMatches + ' 场比赛未完成'}\n`;
        message += `   - 结果：${finalsComplete ? '满足' : '不满足'}\n`;
      }
    } else if (tournament.format === 'SWISS') {
      // 1. 检查是否已完成足够轮数（通常是4轮）
      const minRounds = 4;
      const hasEnoughRounds = tournament.rounds.length >= minRounds;
      canEndTournament = canEndTournament && hasEnoughRounds;
      
      message += `1. 轮次数量要求：${hasEnoughRounds ? '✅' : '❌'}\n`;
      message += `   - 需要完成至少 ${minRounds} 轮比赛\n`;
      message += `   - 当前已完成 ${tournament.rounds.length} 轮\n`;
      message += `   - 结果：${hasEnoughRounds ? '满足' : '不满足，还需要' + (minRounds - tournament.rounds.length) + '轮'}\n\n`;

      // 2. 检查当前轮次是否全部完成
      const currentRound = tournament.rounds[tournament.rounds.length - 1];
      const incompleteMatches = currentRound.matches.filter(match => match.winner == null).length;
      const roundComplete = incompleteMatches === 0;
      canEndTournament = canEndTournament && roundComplete;

      message += `2. 当前轮次完成要求：${roundComplete ? '✅' : '❌'}\n`;
      message += `   - 需要：当前轮次所有比赛都记录结果\n`;
      message += `   - 当前：${roundComplete ? '已完成' : '还有 ' + incompleteMatches + ' 场比赛未完成'}\n`;
      message += `   - 结果：${roundComplete ? '满足' : '不满足'}\n`;
    } else {
      console.error('Unknown tournament format:', tournament.format);
      message += `❌ 错误：未知的比赛类型 (${tournament.format})\n`;
      message += '请联系管理员修复此问题';
      canEndTournament = false;
    }

    message += '\n结论：' + (canEndTournament ? '✅ 可以结束比赛' : '❌ 无法结束比赛，请满足以上所有条件');

    enqueueSnackbar(message, { 
      variant: canEndTournament ? 'success' : 'warning',
      autoHideDuration: 12000,
      style: { 
        whiteSpace: 'pre-line',
        maxWidth: '500px'
      }
    });

    if (canEndTournament) {
      navigate(`/tournament/${id}/results`);
    }
  };

  const handleGenerateNextRound = async () => {
    try {
      const response = await axios.post(`/api/tournaments/${id}/rounds`);
      console.log('Generate next round response:', response.data);
      await fetchTournament();  // 等待数据刷新完成
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
      // 验证获胜者是否是比赛选手之一
      const validPlayers = [
        selectedMatch.player1?._id || '',
        selectedMatch.player2?._id || ''
      ].filter(id => id !== '');

      if (!validPlayers.includes(winnerId)) {
        enqueueSnackbar('Invalid winner selected', { variant: 'error' });
        return;
      }

      const response = await axios.put(
        `/api/tournaments/${id}/matches/${selectedMatch._id}`,
        { winnerId }
      );

      enqueueSnackbar('Match result recorded successfully', { variant: 'success' });
      setOpenDialog(false);
      setSelectedMatch(null);
      await fetchTournament();
    } catch (error) {
      console.error('Error recording result:', error);
      enqueueSnackbar('Failed to record match result', { variant: 'error' });
    }
  };

  const handleDeleteRound = async (roundNumber: number) => {
    try {
      const response = await axios.delete(`/api/tournaments/${id}/rounds/${roundNumber}`);
      console.log('Delete round response:', response.data);
      await fetchTournament();  // 等待数据刷新完成
      enqueueSnackbar('Round deleted successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error deleting round:', error);
      enqueueSnackbar('Failed to delete round', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {tournament.name} - Matches
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Tournament Status: {tournament.status}
        </Typography>
        <Typography variant="body1" gutterBottom>
          Format: {tournament.format}
        </Typography>
        <Typography variant="body1" gutterBottom>
          Players: {tournament.players?.length || 0}
        </Typography>
      </Box>

      {tournament.rounds?.map((round, roundIndex) => (
        <Box key={roundIndex} sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">
              Round {round.roundNumber}
            </Typography>
            {tournament.status === 'ONGOING' && roundIndex === tournament.rounds.length - 1 && (
              <IconButton
                onClick={() => handleDeleteRound(round.roundNumber)}
                sx={{ ml: 2 }}
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>

          {round.matches?.map((match, matchIndex) => (
            <Card key={matchIndex} sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={5}>
                    <Box>
                      <Typography>
                        {match.player1?.name || 'TBD'} 
                        <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
                          {tournament.players.find(p => p._id === match.player1?._id)?.score || 0}分
                        </Typography>
                      </Typography>
                      {match.winner?._id === match.player1?._id && (
                        <Typography color="primary" variant="caption">
                          (Winner)
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography align="center">vs</Typography>
                  </Grid>
                  <Grid item xs={5}>
                    <Box>
                      <Typography>
                        {match.player2?.name || 'TBD'}
                        <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
                          {tournament.players.find(p => p._id === match.player2?._id)?.score || 0}分
                        </Typography>
                      </Typography>
                      {match.winner?._id === match.player2?._id && (
                        <Typography color="primary" variant="caption">
                          (Winner)
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>

                {tournament.status === 'ONGOING' && roundIndex === tournament.rounds.length - 1 && (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setSelectedMatch(match);
                      setOpenDialog(true);
                    }}
                    sx={{ mt: 1 }}
                    fullWidth
                  >
                    {match.winner ? 'Update Result' : 'Record Result'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      ))}

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        {canGenerateNextRound && (
          <Button
            variant="contained"
            onClick={handleGenerateNextRound}
            disabled={!canGenerateNextRound}
          >
            Generate Next Round
          </Button>
        )}

        {tournament.status === 'ONGOING' && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleEndTournament}
          >
            End Tournament
          </Button>
        )}
      </Box>

      <RecordResultDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        match={selectedMatch}
        onSave={handleRecordResult}
      />
    </Box>
  );
};

export default TournamentMatches;