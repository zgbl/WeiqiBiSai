import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const NewTournament = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    format: 'ROUNDROBIN',
    startDate: '',
    endDate: '',
    description: '',
  });

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
      const response = await axios.post('http://localhost:3000/api/tournaments', formData);
      console.log('Tournament created:', response.data);
      navigate('/');
    } catch (error: any) {
      console.error('Error creating tournament:', error.response?.data || error.message);
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
                  <MenuItem value="ROUNDROBIN">单循环赛 Round Robin</MenuItem>
                  <MenuItem value="SINGLEELIMINATION">单淘汰赛 Single Elimination</MenuItem>
                  <MenuItem value="DOUBLEELIMINATION">双淘汰赛 Double Elimination</MenuItem>
                  <MenuItem value="SWISS">积分循环赛 Swiss System</MenuItem>
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
                multiline
                rows={4}
                value={formData.description}
                onChange={handleChange}
                helperText={
                  formData.format === 'SWISS' ? 
                  '积分循环赛说明：每轮根据选手积分进行配对，胜者得1分，负者得0分。总轮数由选手数量决定。' : 
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
