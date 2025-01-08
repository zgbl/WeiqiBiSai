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
      navigate(`/tournament/${id}/results`);
    }
  };

  const handleGenerateNextRound = async () => {
    try {
      // 记录生成新一轮前的选手得分
      console.log('=== 生成新一轮前的选手得分 ===');
      tournament.rounds[tournament.rounds.length - 1].matches.forEach(match => {
        console.log(`选手1 ${match.player1.name}:`, {
          name: match.player1.name,
          score: match.player1Score,
          variable: 'match.player1Score'
        });
        console.log(`选手2 ${match.player2.name}:`, {
          name: match.player2.name,
          score: match.player2Score,
          variable: 'match.player2Score'
        });
      });

      console.log('Generating next round...');
      const response = await axios.post(`/api/tournaments/${id}/rounds`);
      console.log('Next round response:', response.data);

      // 记录生成新一轮后的选手得分
      console.log('=== 生成新一轮后的选手得分 ===');
      response.data.rounds[response.data.rounds.length - 1].matches.forEach(match => {
        console.log(`选手1 ${match.player1.name}:`, {
          name: match.player1.name,
          score: match.player1Score,
          variable: 'match.player1Score'
        });
        console.log(`选手2 ${match.player2.name}:`, {
          name: match.player2.name,
          score: match.player2Score,
          variable: 'match.player2Score'
        });
      });

      await fetchTournament();
      enqueueSnackbar('下一轮比赛已生成', { variant: 'success' });
    } catch (error) {
      console.error('Error generating next round:', error);
      enqueueSnackbar('生成下一轮比赛失败', { variant: 'error' });
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

      // 记录保存前的分数
      console.log('=== 保存结果前的分数 ===');
      console.log(`选手1 ${selectedMatch.player1?.name}: ${selectedMatch.player1Score}分`);
      console.log(`选手2 ${selectedMatch.player2?.name}: ${selectedMatch.player2Score}分`);
      console.log(`获胜者ID: ${winnerId}`);

      const response = await axios.put(
        `/api/tournaments/${id}/matches/${selectedMatch._id}/result`,
        { winnerId }
      );

      // 获取更新后的比赛数据
      const updatedTournament = await axios.get(`/api/tournaments/${id}`);
      const updatedMatch = updatedTournament.data.rounds
        .flatMap((r: any) => r.matches)
        .find((m: any) => m._id === selectedMatch._id);

      if (updatedMatch) {
        console.log('=== 保存结果后的分数 ===');
        console.log(`选手1 ${updatedMatch.player1?.name}: ${updatedMatch.player1Score}分`);
        console.log(`选手2 ${updatedMatch.player2?.name}: ${updatedMatch.player2Score}分`);
      }

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
      setDeleteDialogOpen(false);
      setRoundToDelete(null);
      await fetchTournament();
      enqueueSnackbar('轮次删除成功', { variant: 'success' });
    } catch (error) {
      console.error('Error deleting round:', error);
      enqueueSnackbar('删除轮次失败', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {tournament.name} - Matches
      </Typography>

      {/* 删除轮次确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>确认删除轮次</DialogTitle>
        <DialogContent>
          <Typography>
            你确定要删除第 {roundToDelete} 轮吗？此操作不可撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button 
            onClick={() => roundToDelete && handleDeleteRound(roundToDelete)} 
            color="error"
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

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
            <Typography variant="h5" sx={{ flexGrow: 1 }}>
              Round {round.roundNumber}
            </Typography>
            {tournament.status === 'ONGOING' && roundIndex === tournament.rounds.length - 1 && !round.completed && (
              <IconButton
                onClick={() => {
                  setRoundToDelete(round.roundNumber);
                  setDeleteDialogOpen(true);
                }}
                color="error"
                sx={{ ml: 1 }}
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
          <Grid container spacing={2}>
            {round.matches.map((match, matchIndex) => (
              <Grid item xs={12} key={matchIndex}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box flex={1} textAlign="right">
                        <Typography variant="subtitle1">
                          {match.player1?.name} {match.player1?.rank}
                          {match.player1Score !== undefined && ` (${match.player1Score}分)`}
                        </Typography>
                      </Box>
                      <Box mx={2}>
                        <Typography variant="h6">vs</Typography>
                      </Box>
                      <Box flex={1} textAlign="left">
                        <Typography variant="subtitle1">
                          {match.player2?.name} {match.player2?.rank}
                          {match.player2Score !== undefined && ` (${match.player2Score}分)`}
                        </Typography>
                      </Box>
                      {!match.winner && !round.completed && (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => {
                            setSelectedMatch(match);
                            setOpenDialog(true);
                          }}
                          sx={{ ml: 2 }}
                        >
                          Record Result
                        </Button>
                      )}
                      {match.winner && (
                        <Typography
                          variant="subtitle1"
                          color="primary"
                          sx={{ ml: 2 }}
                        >
                          Winner: {match.winner.name}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

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