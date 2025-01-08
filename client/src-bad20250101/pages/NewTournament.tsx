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
  Divider,
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

const NewTournament = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    format: 'ROUNDROBIN',
    startDate: '',
    endDate: '',
    description: '',
    // McMahon specific fields
    upperBar: 5, // 5段为默认上限
    initialScore: 0,
    minimumScore: -3,
    roundCount: 5,
    groups: ['业余组', '职业组'],
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
      // 验证 McMahon 特定的字段
      if (formData.format === 'MCMAHON') {
        if (formData.upperBar === undefined || formData.initialScore === undefined || formData.minimumScore === undefined) {
          throw new Error('Please fill in all McMahon specific fields');
        }
        if (Number(formData.minimumScore) > Number(formData.initialScore)) {
          throw new Error('Minimum score cannot be greater than initial score');
        }
      }

      // 转换数字字段
      const dataToSubmit = {
        ...formData,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        // McMahon specific fields
        ...(formData.format === 'MCMAHON' && {
          upperBar: Number(formData.upperBar),
          initialScore: Number(formData.initialScore),
          minimumScore: Number(formData.minimumScore),
          roundCount: Number(formData.roundCount),
        })
      };

      console.log('Submitting data:', dataToSubmit); // 添加日志
      const response = await axios.post(`${API_BASE_URL}/tournaments`, dataToSubmit);
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
                  <MenuItem value="MCMAHON">麦克马洪制 McMahon</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* McMahon specific fields */}
            {formData.format === 'MCMAHON' && (
              <>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      McMahon System Settings
                    </Typography>
                  </Divider>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Upper Bar (段/级)"
                    name="upperBar"
                    type="number"
                    value={formData.upperBar}
                    onChange={handleChange}
                    required
                    helperText="高于此等级的选手将获得相同的起始分数"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Initial Score"
                    name="initialScore"
                    type="number"
                    value={formData.initialScore}
                    onChange={handleChange}
                    required
                    helperText="最高段位选手的起始分数"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Minimum Score"
                    name="minimumScore"
                    type="number"
                    value={formData.minimumScore}
                    onChange={handleChange}
                    required
                    helperText="最低分数限制"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Round Count"
                    name="roundCount"
                    type="number"
                    value={formData.roundCount}
                    onChange={handleChange}
                    required
                    helperText="比赛轮数"
                  />
                </Grid>
              </>
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
                  formData.format === 'MCMAHON' ?
                  'McMahon赛制说明：选手的初始分数根据段位确定，每轮根据当前分数配对，胜者得1分，负者得0分。' :
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
