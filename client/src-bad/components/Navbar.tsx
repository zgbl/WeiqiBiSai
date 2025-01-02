import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const Navbar = () => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{
            flexGrow: 1,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          WeiqiBiSai
        </Typography>
        <Box>
          <Button
            color="inherit"
            component={RouterLink}
            to="/"
          >
            Home
          </Button>
          <Button
            color="inherit"
            component={RouterLink}
            to="/players"
          >
            Players
          </Button>
          <Button
            color="inherit"
            component={RouterLink}
            to="/tournament/new"
          >
            New Tournament
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
