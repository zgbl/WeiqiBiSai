import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enqueueSnackbar } from 'notistack';
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
import { TournamentFormat } from '../types/tournament';

const NewTournament = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    format: TournamentFormat.MCMAHON,
    startDate: '',
    endDate: '',
    description: '',
    groups: ['Open', 'Dan', 'High-Kyu', 'Low-Kyu']  
  });

  const tournamentFormats = [
    { value: TournamentFormat.MCMAHON, label: '麦克马洪赛制 McMahon System' },
    { value: TournamentFormat.SWISS, label: '瑞士循环赛 Swiss System' },
    { value: TournamentFormat.SINGLEELIMINATION, label: '单淘汰赛 Single Elimination' },
    { value: TournamentFormat.DOUBLEELIMINATION, label: '双淘汰赛 Double Elimination' },
    { value: TournamentFormat.ROUNDROBIN, label: '循环赛 Round Robin' }
  ];

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
      // 基本验证
      if (!formData.name || !formData.format || !formData.startDate || !formData.endDate) {
        enqueueSnackbar('Please fill in all required fields', { variant: 'error' });
        return;
      }

      // 验证日期
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      if (endDate < startDate) {
        enqueueSnackbar('End date cannot be earlier than start date', { variant: 'error' });
        return;
      }

      const data = {
        ...formData,
        format: formData.format,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groups: formData.groups
      };
      
      console.log('Submitting tournament data:', data);
      const response = await axios.post('http://localhost:3000/api/tournaments', data);
      
      if (response.data) {
        console.log('Tournament created:', response.data);
        enqueueSnackbar('Tournament created successfully!', { variant: 'success' });
        navigate('/'); 
      }
    } catch (error: any) {
      console.error('Error creating tournament:', error);
      let errorMessage = 'Failed to create tournament';
      
      if (error.response?.data?.errors) {
        errorMessage = Array.isArray(error.response.data.errors) 
          ? error.response.data.errors[0]
          : error.response.data.errors;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  return (
    <div>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Tournament
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
                  {tournamentFormats.map((format) => (
                    <MenuItem key={format.value} value={format.value}>
                      {format.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {formData.format === TournamentFormat.MCMAHON && (
              <Grid item xs={12}>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    McMahon System Settings
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Players will be automatically grouped based on their ranks:
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography variant="body2" color="text.secondary">• Open Group: 6-9 dan (5 dan if not enough strong players)</Typography>
                    <Typography variant="body2" color="text.secondary">• Dan Group: 1-4 dan</Typography>
                    <Typography variant="body2" color="text.secondary">• High-Kyu Group: 1-10 kyu</Typography>
                    <Typography variant="body2" color="text.secondary">• Low-Kyu Group: 11+ kyu</Typography>
                  </Box>
                </Box>
              </Grid>
            )}

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
                multiline
                rows={4}
                value={formData.description}
                onChange={handleChange}
                helperText={
                  formData.format === TournamentFormat.SWISS ? 
                  '积分循环赛说明：每轮根据选手积分进行配对，胜者得1分，负者得0分。总轮数由选手数量决定。' : 
                  formData.format === TournamentFormat.MCMAHON ? 
                  'McMahon系统说明：选手根据段位自动分组，比赛采用循环赛制。' : 
                  '请输入比赛说明'
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={() => navigate('/')} variant="outlined">
                  Cancel
                </Button>
                <Button type="submit" variant="contained" color="primary">
                  Create Tournament
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </div>
  );
};

export default NewTournament;
