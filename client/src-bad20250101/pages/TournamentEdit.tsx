import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

const TournamentEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    name: '',
    format: '',
    startDate: '',
    endDate: '',
    description: '',
  });

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/tournaments/${id}`);
        const tournament = response.data;
        setFormData({
          name: tournament.name,
          format: tournament.format.toLowerCase(),
          startDate: tournament.startDate.split('T')[0],
          endDate: tournament.endDate.split('T')[0],
          description: tournament.description || '',
        });
      } catch (error) {
        console.error('Error fetching tournament:', error);
        navigate('/');
      }
    };

    fetchTournament();
  }, [id, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name as string]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE_URL}/tournaments/${id}`, formData);
      navigate(`/tournament/${id}`);
    } catch (error: any) {
      console.error('Error updating tournament:', error.response?.data || error.message);
    }
  };

  return (
    <div>
      <Typography variant="h4" component="h1" gutterBottom>
        Edit Tournament
      </Typography>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tournament Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Tournament Format</InputLabel>
                <Select
                  name="format"
                  value={formData.format}
                  onChange={handleChange}
                  required
                >
                  <MenuItem value="knockout">Knockout</MenuItem>
                  <MenuItem value="roundrobin">Round Robin</MenuItem>
                  <MenuItem value="swiss">Swiss</MenuItem>
                  <MenuItem value="mcmahon">McMahon</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Start Date"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date"
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                multiline
                rows={4}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(`/tournament/${id}`)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                >
                  Save Changes
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </div>
  );
};

export default TournamentEdit;