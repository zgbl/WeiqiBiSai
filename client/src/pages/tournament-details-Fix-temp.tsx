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
import { api } from '../services/api';

// ... (keep all interfaces and enums the same)

const TournamentDetails = () => {
  // ... (keep all state declarations the same)

  const handleAddPlayer = async () => {
    try {
      setError('');
      if (isNewPlayer) {
        if (!newPlayer.name || !newPlayer.rank) {
          setError('Name and rank are required');
          return;
        }
        // First create the new player
        const playerResponse = await api.post('/tournaments/players', newPlayer);
        const newPlayerId = playerResponse.data._id;
        
        // Then add the player to the tournament
        await api.post(`/tournaments/${id}/addPlayer`, {
          playerId: newPlayerId
        });
      } else {
        if (!selectedExistingPlayer) {
          setError('Please select a player');
          return;
        }
        // Add existing player to tournament
        await api.post(`/tournaments/${id}/addPlayer`, {
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

  // ... (keep rest of the component the same)
};

export default TournamentDetails;
