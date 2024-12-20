# WeiqiBiSai - GO Tournament Management System

A modern TypeScript-based web application for managing GO (Weiqi) tournaments with support for various tournament formats.

## Features

- Multiple tournament formats:
  - Single Knockout
  - Round Robin
  - Swiss System
  - McMahon System
- Player management with dan/kyu rankings
- Automated pairing generation
- Tournament progress tracking
- Match result recording
- Player statistics

## Technology Stack

- Backend:
  - Node.js
  - TypeScript
  - Express.js
  - MongoDB with Mongoose
  - JWT Authentication
- Development:
  - ESLint
  - Jest for testing
  - Nodemon for development

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your configuration (use `.env.example` as template)
4. Build the TypeScript code:
   ```bash
   npm run build
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Tournaments
- `GET /api/tournaments` - List all tournaments
- `GET /api/tournaments/:id` - Get tournament details
- `POST /api/tournaments` - Create new tournament
- `POST /api/tournaments/:id/players` - Add player to tournament
- `POST /api/tournaments/:id/rounds` - Generate next round
- `PUT /api/tournaments/:id/matches` - Update match results

### Players
- `GET /api/players` - List all players
- `POST /api/players` - Register new player
- `GET /api/players/:id` - Get player details
- `GET /api/players/:id/stats` - Get player statistics

## Tournament Formats

### Single Knockout
- Players are paired randomly in the first round
- Winners advance to the next round
- Losers are eliminated
- Tournament continues until there's a single winner

### Round Robin
- Each player plays against every other player
- Points are awarded for wins/draws
- Final ranking based on total points

### Swiss System
- Players are paired with others having similar scores
- No player meets the same opponent twice
- Suitable for large tournaments with limited rounds

### McMahon System
- Modified Swiss system common in GO tournaments
- Players start with different initial scores based on rank
- Pairing within score groups
- Suitable for players of different strengths

## Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Run production server
npm start
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
