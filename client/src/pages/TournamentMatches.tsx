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
  CardContent,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { api, TournamentAPI } from '../services/api';
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
  format: 'ROUNDROBIN' | 'SINGLEELIMINATION' | 'DOUBLEELIMINATION' | 'SWISS' | 'MCMAHON';
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
  const [selectedWinner, setSelectedWinner] = useState<string>('');
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open) {
      // 重置状态
      setSelectedWinner('');
    }
  }, [open, match]);

  if (!match) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record Match Result</DialogTitle>
      <DialogContent>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: 2,
          mt: 1
        }}>
          <FormControl>
            <FormLabel>Select Winner</FormLabel>
            <RadioGroup
              row
              value={selectedWinner}
              onChange={(e) => setSelectedWinner(e.target.value)}
            >
              <Box sx={{ 
                display: 'flex', 
                width: '100%', 
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 1
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  flex: 1,
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mr: 1,
                  bgcolor: selectedWinner === match.player1._id ? 'action.selected' : 'transparent'
                }}>
                  <FormControlLabel
                    value={match.player1._id}
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle1">
                          {match.player1.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Rank: {match.player1.rank}
                        </Typography>
                      </Box>
                    }
                  />
                </Box>

                <Typography variant="h6" sx={{ mx: 2 }}>vs</Typography>

                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  flex: 1,
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  ml: 1,
                  bgcolor: selectedWinner === match.player2._id ? 'action.selected' : 'transparent'
                }}>
                  <FormControlLabel
                    value={match.player2._id}
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle1">
                          {match.player2.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Rank: {match.player2.rank}
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
              </Box>
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onSave(selectedWinner)}
          disabled={!selectedWinner}
        >
          Save Result
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
            <TableCell align="right">{result.totalScore}</TableCell>
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
  const [rankingDialogOpen, setRankingDialogOpen] = useState(false);
  const [currentRankings, setCurrentRankings] = useState<any[]>([]);
  const { enqueueSnackbar } = useSnackbar();

  // 添加计算选手积分的函数
  const calculatePlayerScores = () => {
    if (!tournament) return new Map<string, number>();
    
    const scores = new Map<string, number>();
    
    // 初始化所有选手的积分为0
    tournament.players.forEach(player => {
      scores.set(player._id, 0);
    });
    
    // 计算每个选手的积分
    tournament.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.winner) {
          // 胜者得2分
          scores.set(match.winner._id, (scores.get(match.winner._id) || 0) + 2);
        } else if (match.result === 'DRAW') {
          // 平局各得1分
          scores.set(match.player1._id, (scores.get(match.player1._id) || 0) + 1);
          scores.set(match.player2._id, (scores.get(match.player2._id) || 0) + 1);
        }
      });
    });
    
    return scores;
  };

  const fetchTournament = async () => {
    try {
      const response = await api.get(`/tournaments/${id}`);
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
  const isLastRoundComplete = currentRound?.matches?.every(match => match.winner != null) || false;
  const canGenerateNextRound = tournament.status === 'ONGOING' && currentRound && isLastRoundComplete;

  console.log('Debug button visibility:', {
    status: tournament.status,
    currentRoundNumber,
    currentRound,
    matches: currentRound?.matches,
    isLastRoundComplete,
    canGenerateNextRound
  });

  console.log('Tournament state:', {
    currentRoundNumber,
    currentRound,
    isLastRoundComplete,
    canGenerateNextRound,
    roundMatches: currentRound?.matches,
    tournamentStatus: tournament.status
  });

  const canEnd = tournament.rounds?.every(round => round.completed) || false;

  const handleEndTournament = async () => {   //加上了async 2025.1.7
    if (!tournament) {
      enqueueSnackbar('比赛数据未加载', { variant: 'error' });
      return;
    }

    console.log('正在结束比赛,Tournament data:', {
      id: tournament._id,
      name: tournament.name,
      format: tournament.format,
      status: tournament.status,
      rounds: tournament.rounds.length
    });

    let message = '比赛结束条件检查：\n\n';
    let canEndTournament = true;

    // 1. 检查轮次数量
    const minRequiredRounds = 4;
    const currentRounds = tournament.rounds.length;
    const roundsComplete = currentRounds >= minRequiredRounds;
    canEndTournament = canEndTournament && roundsComplete;
    
    message += `1. 轮次数量要求：${roundsComplete ? '✅' : '❌'}\n`;
    message += `   - 需要完成至少 ${minRequiredRounds} 轮比赛\n`;
    message += `   - 当前已完成 ${currentRounds} 轮\n`;
    message += `   - 结果：${roundsComplete ? '满足' : '不满足，还需要' + (minRequiredRounds - currentRounds) + '轮'}\n\n`;

    // 2. 检查当前轮次完成要求
    const currentRound = tournament.rounds[tournament.rounds.length - 1];
    const isCurrentRoundComplete = currentRound?.matches.every(match => match.winner != null) || false;
    canEndTournament = canEndTournament && isCurrentRoundComplete;

    message += `2. 当前轮次完成要求：${isCurrentRoundComplete ? '✅' : '❌'}\n`;
    message += `   - 需要：当前轮次所有比赛都记录结果\n`;
    message += `   - 当前：${isCurrentRoundComplete ? '已完成' : '未完成'}\n`;
    message += `   - 结果：${isCurrentRoundComplete ? '满足' : '不满足'}\n\n`;

    message += `结论：${canEndTournament ? '✅ 可以结束比赛' : '❌ 无法结束比赛，请满足以上所有条件'}`;

    // 显示消息
    enqueueSnackbar(message, {
      variant: canEndTournament ? 'success' : 'error',
      autoHideDuration: 12000,
      style: { 
        whiteSpace: 'pre-line',
        maxWidth: '500px'
      }
    });

    if (canEndTournament) {
      try {
        // 发送结束比赛的请求
        const response = await api.put(`/tournaments/${id}/end`);
        console.log('Tournament ended successfully:', response.data);
        
        // 显示成功消息
        enqueueSnackbar('比赛已成功结束', { variant: 'success' });
        
        // 跳转到结果页面
        navigate(`/tournament/${id}/results`);
      } catch (error) {
        console.error('Error ending tournament:', error);
        enqueueSnackbar('结束比赛失败，请重试', { variant: 'error' });
      }
    }
  };

  const handleGenerateNextRound = async () => {
    try {
      console.log('Generating next round...');
      const response = await api.post(`/tournaments/${id}/rounds`);
      console.log('Next round response:', response.data);
      await fetchTournament();
      enqueueSnackbar('下一轮比赛已生成', { variant: 'success' });
    } catch (error: any) {
      console.error('Error generating next round:', error);
      enqueueSnackbar(error.response?.data?.message || '生成下一轮比赛失败', { variant: 'error' });
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

      const response = await api.put(
        `/tournaments/${id}/matches/${selectedMatch._id}/result`,
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
      console.log('Deleting round:', roundNumber);
      const response = await TournamentAPI.deleteRound(id!, roundNumber);
      console.log('Delete round response:', response);
      await fetchTournament();  // 等待数据刷新完成
      enqueueSnackbar('Round deleted successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error deleting round:', error);
      enqueueSnackbar('Failed to delete round', { variant: 'error' });
    }
  };

  const handleViewCurrentRankings = async () => {
    try {
      console.log('Fetching current rankings...');
      const response = await api.get(`/tournaments/${id}/results`);
      console.log('Rankings response:', response.data);
      setCurrentRankings(response.data.results || []);
      setRankingDialogOpen(true);
    } catch (error) {
      console.error('Error fetching current rankings:', error);
      enqueueSnackbar('获取即时排名失败', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {tournament.name} - Matches
      </Typography>
      <Typography variant="h6" gutterBottom>
        Tournament Status: {tournament.status}
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Format: {tournament.format}
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Players: {tournament.players?.length || 0}
      </Typography>

      {tournament.rounds?.map((round, roundIndex) => {
        const playerScores = calculatePlayerScores();
        
        return (
          <StyledPaper key={roundIndex}>
            <Box display="flex" alignItems="center" mb={2}>
              <Typography variant="h5" style={{ flexGrow: 1 }}>
                Round {roundIndex + 1}
              </Typography>
              {roundIndex === tournament.rounds.length - 1 && (
                <IconButton
                  onClick={() => {
                    setRoundToDelete(roundIndex + 1);
                    setDeleteDialogOpen(true);
                  }}
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
            
            {round.matches.map((match, matchIndex) => (
              <Card key={matchIndex} style={{ marginBottom: '1rem' }}>
                <CardContent>
                  <Grid container alignItems="center" spacing={2}>
                    <Grid item xs={5} style={{ textAlign: 'right' }}>
                      <Typography>
                        {match.player1.name} {match.player1.rank}
                        {/* 显示选手1的积分 */}
                        <Typography component="span" color="textSecondary" style={{ marginLeft: 8 }}>
                          ({playerScores.get(match.player1._id) || 0}分)
                        </Typography>
                      </Typography>
                    </Grid>
                    <Grid item xs={2} style={{ textAlign: 'center' }}>
                      <Typography>vs</Typography>
                    </Grid>
                    <Grid item xs={5} style={{ textAlign: 'left' }}>
                      <Typography>
                        {match.player2.name} {match.player2.rank}
                        {/* 显示选手2的积分 */}
                        <Typography component="span" color="textSecondary" style={{ marginLeft: 8 }}>
                          ({playerScores.get(match.player2._id) || 0}分)
                        </Typography>
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  {match.winner ? (
                    <Typography
                      color="primary"
                      style={{ textAlign: 'center', marginTop: '8px' }}
                    >
                      Winner: {match.winner.name}
                    </Typography>
                  ) : (
                    <Box textAlign="center" mt={1}>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => {
                          setSelectedMatch(match);
                          setOpenDialog(true);
                        }}
                      >
                        RECORD RESULT
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </StyledPaper>
        );
      })}

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <ActionButton
            className="next-round"
            onClick={handleGenerateNextRound}
          >
            Generate Next Round
          </ActionButton>
        </Box>

        <Button
          variant="contained"
          color="primary"
          onClick={handleEndTournament}
        >
          End Tournament
        </Button>

        <Button
          variant="contained"
          color="info"
          onClick={handleViewCurrentRankings}
        >
          即时排名
        </Button>
      </Box>

      <RecordResultDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        match={selectedMatch}
        onSave={handleRecordResult}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Round</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete round {roundToDelete}? This action cannot be undone.
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

      <Dialog
        open={rankingDialogOpen}
        onClose={() => setRankingDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>当前比赛排名</DialogTitle>
        <DialogContent>
          <ResultsTable results={currentRankings} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRankingDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TournamentMatches;