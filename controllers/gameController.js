// controllers/gameController.js
import qrUtils from '../utils/qrUtils.js';

// Store players and game state
const players = [];
let gameStarted = false;
let hostSessionId = null;
const playerCards = {};

// Turn management
let currentTurnIndex = 0;
const turnOrder = [];
const turnDuration = 10000; // 10 seconds per turn
let turnTimeout = null;

// Clue game cards
const cards = {
  suspects: ["Colonel Mustard", "Professor Plum", "Mr. Green", "Mrs. Peacock", "Miss Scarlet", "Mrs. White"],
  weapons: ["Candlestick", "Knife", "Lead Pipe", "Revolver", "Rope", "Wrench"],
  rooms: ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"]
};

// Solution cards (randomly selected)
const solution = {
  suspect: null,
  weapon: null,
  room: null
};

// Reset game state
function resetGameState() {
  players.length = 0;
  gameStarted = false;
  hostSessionId = null;
  currentTurnIndex = 0;
  turnOrder.length = 0;
  
  if (turnTimeout) {
    clearTimeout(turnTimeout);
    turnTimeout = null;
  }
}

// Start turn rotation
function startTurnRotation() {
  turnOrder.push(...players);
  advanceTurn();
}

// Advance to next turn
function advanceTurn() {
  if (turnOrder.length === 0) return;
  
  const currentPlayer = turnOrder[currentTurnIndex];
  
  // Reset timeout if exists
  if (turnTimeout) {
    clearTimeout(turnTimeout);
  }
  
  // Set timeout for next turn
  turnTimeout = setTimeout(() => {
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    advanceTurn();
  }, turnDuration);
}

// Getter for current turn
function getCurrentTurn() {
  return turnOrder[currentTurnIndex] || null;
}

// Modified home function to handle game state more robustly
export function home(req, res) {
    
    // Set this session as the host if not already set
    if (!hostSessionId) {
        hostSessionId = req.session.id;
    }

    const isHost = (req.session.id === hostSessionId);
    
    const qrData = `http://${req.headers.host}/login`; // URL for the login page
    qrUtils.generateQRCode(qrData, (qrCodeUrl) => {
        if (qrCodeUrl) {
            if (isHost) {
                // Host view with QR code and begin button
                res.render('index', { 
                    qrCodeUrl, 
                    playerCount: players.length, 
                    isHost: true 
                });
            } else {
                // Non-host view redirects to login
                res.redirect('/login');
            }
        } else {
            res.status(500).send("Failed to generate QR code");
        }
    });
}

// Modified loginPage function to handle existing game state
export function loginPage(req, res) {
    // If game has already started and user is not a player, prevent login
    if (gameStarted) {
        if (req.session.playerName && players.includes(req.session.playerName)) {
            return res.redirect('/waiting');
        } else if (req.session.id === hostSessionId) {
            return res.redirect('/game');
        } else {
            return res.send("Sorry, the game has already started!");
        }
    }
    
    // Don't allow the host to also be a player
    if (req.session.id === hostSessionId) {
        return res.redirect('/');
    }
    
    // If player is already logged in, redirect to waiting page
    if (req.session.playerName && players.includes(req.session.playerName)) {
        return res.redirect('/waiting');
    }
    
    // Otherwise, show login page
    res.render('login');
}

// Submit player name and redirect to a waiting page
export function submitName(req, res) {
    if (gameStarted) {
        return res.send("Sorry, the game has already started!");
    }
    
    // Don't allow host to be a player
    if (req.session.id === hostSessionId) {
        return res.redirect('/');
    }
    
    const playerName = req.body.name;
    
    // Validate name
    if (!playerName || playerName.trim() === '') {
        return res.send("Please enter a valid name.");
    }
    
    // Check if name is already taken
    if (players.includes(playerName)) {
        return res.send("This name is already taken. Please choose another.");
    }
    
    // Add player to the list
    players.push(playerName);
    
    // Store in session
    req.session.playerName = playerName;
    
    // Redirect to waiting page instead of rendering
    res.redirect('/waiting');
}

// Start game with turn management
export function startGame(req, res) {
    // Only the host can start the game
    if (req.session.id !== hostSessionId) {
        return res.status(403).json({ success: false, message: "Only the host can start the game" });
    }
    
    if (players.length < 2) {
        return res.status(400).json({ success: false, message: "Need at least 2 players to start" });
    }
    
    gameStarted = true;
    
    // Randomly select solution cards
    solution.suspect = cards.suspects[Math.floor(Math.random() * cards.suspects.length)];
    solution.weapon = cards.weapons[Math.floor(Math.random() * cards.weapons.length)];
    solution.room = cards.rooms[Math.floor(Math.random() * cards.rooms.length)];
    
    // Create deck without solution cards
    const deck = [
        ...cards.suspects.filter(card => card !== solution.suspect),
        ...cards.weapons.filter(card => card !== solution.weapon),
        ...cards.rooms.filter(card => card !== solution.room)
    ];
    
    // Shuffle the deck
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    // Deal cards to players
    playerCards['host'] = []; // Host gets cards too for display purposes
    players.forEach(player => {
        playerCards[player] = [];
    });
    
    // Deal cards evenly
    let currentPlayer = 0;
    for (let i = 0; i < deck.length; i++) {
        if (currentPlayer >= players.length) {
            currentPlayer = 0;
        }
        playerCards[players[currentPlayer]].push(deck[i]);
        currentPlayer++;
    }
    
    // Start turn rotation
    startTurnRotation();
    
    res.json({ success: true, message: "Game started!", firstPlayer: getCurrentTurn() });
}

// API endpoint to get current player count
export function getPlayerCount(req, res) {
    res.json({ count: players.length, players: players });
}

export function deductionPage(req, res) {
    if (!gameStarted) {
        return res.redirect('/');
    }
    
    // Redirect host to game page
    if (req.session.id === hostSessionId) {
        return res.redirect('/game');
    }
    
    // Player view
    const playerName = req.session.playerName;
    if (!playerName || !players.includes(playerName)) {
        return res.redirect('/login');
    }
    
    res.render('deduction', { 
        playerName,
        playerCards: playerCards[playerName] || [],
        suspects: cards.suspects,
        weapons: cards.weapons,
        rooms: cards.rooms
    });
}

// Waiting page after player submits name
export function waitingPage(req, res) {
    if (req.session.playerName && players.includes(req.session.playerName)) {
        res.render('waiting', { playerName: req.session.playerName });
    } else {
        console.log('redirecting to login page')
        res.redirect('/login');
    }
}


// Modified game page to include current turn information
export function gamePage(req, res) {
    if (!gameStarted) {
        return res.redirect('/');
    }
    
    // Host view
    if (req.session.id === hostSessionId) {
        return res.render('host-game', { 
            players,
            currentTurn: getCurrentTurn()
        });
    }
    
    // Player view
    const playerName = req.session.playerName;
    if (!playerName || !players.includes(playerName)) {
        return res.redirect('/login');
    }
    
    res.render('game', { 
        playerName,
        playerCards: playerCards[playerName] || [],
        currentTurn: getCurrentTurn()
    });
}

// Expose methods for turn management
export function getCurrentPlayer() {
    return getCurrentTurn();
}

export default { 
    home, 
    loginPage, 
    submitName, 
    getPlayerCount, 
    startGame, 
    gamePage, 
    deductionPage, 
    waitingPage,
    getCurrentPlayer 
};