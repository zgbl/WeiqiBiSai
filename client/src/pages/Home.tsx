import { useState, useEffect } from 'react';
import { Typography, Button, Card, CardContent, Grid, CardActionArea } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface Tournament {
  _id: string;
  name: string;
  format: string;
  startDate: string;
  endDate: string;
  description?: string;
  status: string;
}

const Home = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const response = await api.get('/tournaments');
        setTournaments(response.data);
        setError('');
      } catch (error: any) {
        console.error('Error fetching tournaments:', error.response?.data || error.message);
        setError('Failed to load tournaments. Please try again later.');
      }
    };

    fetchTournaments();
  }, []);

  return (
    <div>
      <Grid container spacing={3} alignItems="center" sx={{ mb: 3 }}>
        <Grid item xs>
          <Typography variant="h3" component="h1">
            GO Tournaments
          </Typography>
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            color="primary"
            component={RouterLink}
            to="/tournament/new"
            size="large"
          >
            Create New Tournament
          </Button>
        </Grid>
      </Grid>

      {error && (
        <Typography color="error" sx={{ mb: 3 }}>
          {error}
        </Typography>
      )}

      <Grid container spacing={3}>
        {tournaments.map((tournament) => (
          <Grid item xs={12} sm={6} md={4} key={tournament._id}>
            <Card>
              <CardActionArea onClick={() => navigate(`/tournament/${tournament._id}`)}>
                <CardContent>
                  <Typography variant="h5" component="h2" gutterBottom>
                    {tournament.name}
                  </Typography>
                  <Typography color="textSecondary" gutterBottom>
                    Format: {tournament.format}
                  </Typography>
                  <Typography color="textSecondary" gutterBottom>
                    Status: {tournament.status}
                  </Typography>
                  <Typography variant="body2" component="p">
                    Start: {new Date(tournament.startDate).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" component="p">
                    End: {new Date(tournament.endDate).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  );
};

export default Home;
