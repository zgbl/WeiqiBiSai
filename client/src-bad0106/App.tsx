import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import NewTournament from './pages/NewTournament';
import TournamentDetails from './pages/TournamentDetails';
import TournamentMatches from './pages/TournamentMatches';
import TournamentResults from './pages/TournamentResults';
import TournamentEdit from './pages/TournamentEdit';
import Players from './pages/Players';
import SnackbarProvider from './components/SnackbarProvider';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <Router>
          <Navbar />
          <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/players" element={<Players />} />
              <Route path="/tournament/new" element={<NewTournament />} />
              <Route path="/tournament/:id" element={<TournamentDetails />} />
              <Route path="/tournament/:id/matches" element={<TournamentMatches />} />
              <Route path="/tournament/:id/results" element={<TournamentResults />} />
              <Route path="/tournament/:id/edit" element={<TournamentEdit />} />
            </Routes>
          </Container>
        </Router>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
