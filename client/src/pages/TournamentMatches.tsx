import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  format: string;
  rounds: Round[];
  status: string;
}

const TournamentMatches = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [winner, setWinner] = useState<string>('');
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState<number | null>(null);

  const fetchTournament = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/tournaments/${id}`);
      setTournament(response.data);
    } catch (error: any) {
      console.error('Error fetching tournament:', error);
      setError(error.response?.data?.message || 'Failed to fetch tournament');
    }
  };

  useEffect(() => {
    if (id) {
      fetchTournament();
    }
  }, [id]);

  const handleNextRound = async () => {
    try {
      await axios.post(`http://localhost:3000/api/tournaments/${id}/rounds`);
      fetchTournament();
    } catch (error: any) {
      console.error('Error generating next round:', error);
      setError(error.response?.data?.message || 'Failed to generate next round');
    }
  };

  const handleRecordResult = async () => {
    if (!selectedMatch || !winner) return;

    try {
      // 找到获胜者的完整信息
      const winnerPlayer = selectedMatch.player1._id === winner ? selectedMatch.player1 : selectedMatch.player2;
      
      await axios.put(
        `http://localhost:3000/api/tournaments/${id}/matches/${selectedMatch._id}`,
        { winnerId: winnerPlayer._id }  // 发送 winnerId 而不是整个 winner 对象
      );
      setOpenDialog(false);
      setSelectedMatch(null);
      setWinner('');
      fetchTournament();
    } catch (error: any) {
      console.error('Error recording match result:', error);
      setError(error.response?.data?.message || 'Failed to record match result');
    }
  };

  const handleDeleteRound = async (roundNumber: number) => {
    try {
      await axios.delete(`http://localhost:3000/api/tournaments/${id}/rounds/${roundNumber}`);
      fetchTournament();
    } catch (error: any) {
      console.error('Error deleting round:', error);
      setError(error.response?.data?.message || 'Failed to delete round');
    }
  };

  if (!tournament) {
    return <Typography>Loading...</Typography>;
  }

  const currentRound = tournament.rounds[tournament.rounds.length - 1];
  const isRoundComplete = currentRound?.matches.every(match => match.winner);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        {tournament.name} - Matches
      </Typography>

      {tournament.rounds.map((round) => (
        <StyledPaper key={round.roundNumber}>
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
                {round.matches.map((match) => (
                  <TableRow key={match._id} sx={{ '&:hover': { backgroundColor: 'rgba(0,0,0,0.02)' } }}>
                    <StyledTableCell>{match.player1.name}</StyledTableCell>
                    <StyledTableCell className="rank-cell">{match.player1.rank}</StyledTableCell>
                    <StyledTableCell className="vs-cell">vs</StyledTableCell>
                    <StyledTableCell>{match.player2?.name || 'Bye'}</StyledTableCell>
                    <StyledTableCell className="rank-cell">{match.player2?.rank || '-'}</StyledTableCell>
                    <StyledTableCell>
                      {match.winner ? match.winner.name : '-'}
                    </StyledTableCell>
                    <StyledTableCell className="action-cell">
                      {!match.winner && (
                        <ActionButton
                          variant="contained"
                          size="small"
                          onClick={() => {
                            setSelectedMatch(match);
                            setOpenDialog(true);
                          }}
                        >
                          Record Result
                        </ActionButton>
                      )}
                    </StyledTableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </StyledPaper>
      ))}

      {isRoundComplete && tournament.status !== 'completed' && (
        <Box sx={{ textAlign: 'center' }}>
          <ActionButton
            className="next-round"
            variant="contained"
            onClick={handleNextRound}
          >
            Generate Next Round
          </ActionButton>
        </Box>
      )}

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        PaperProps={{
          sx: { minWidth: '300px', p: 1 }
        }}
        aria-labelledby="record-result-dialog-title"
        disablePortal={false}
        keepMounted={false}
        onBackdropClick={() => setOpenDialog(false)}
      >
        <DialogTitle id="record-result-dialog-title" sx={{ pb: 2 }}>
          Record Match Result
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="winner-select-label">Winner</InputLabel>
              <Select
                labelId="winner-select-label"
                id="winner-select"
                value={winner}
                label="Winner"
                onChange={(e) => setWinner(e.target.value)}
                autoFocus
              >
                <MenuItem value={selectedMatch?.player1._id}>
                  {selectedMatch?.player1.name}
                </MenuItem>
                {selectedMatch?.player2 && (
                  <MenuItem value={selectedMatch?.player2._id}>
                    {selectedMatch?.player2.name}
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button 
            onClick={() => setOpenDialog(false)}
            tabIndex={0}
          >
            Cancel
          </Button>
          <ActionButton 
            onClick={handleRecordResult} 
            variant="contained"
            tabIndex={0}
          >
            Save Result
          </ActionButton>
        </DialogActions>
      </Dialog>

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