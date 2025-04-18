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
let turnTimeout = null;

// Suggestion tracking
let currentSuggestion = null;

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

// Track eliminated cards for each player
const playerEliminatedCards = {};

// Track if the someone has won the game
let gameOver = false;
let winner = null;

/*--------------------------------------FUNCTIONS--------------------------------------------------------------*/

// home function to handle the qr page ('/' Route)
export function home(req, res) {
  
  // Set this session as the host if not already set
  if (!hostSessionId) {
      hostSessionId = req.session.id;
  }

  const isHost = (req.session.id === hostSessionId); // checks whether the current user is the game host
  
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
              // Non-host view redirects to login (only host show have the home page accesability)
              res.redirect('/login');
          }
      } else {
          res.status(500).send("Failed to generate QR code");
      }
  });
}


// login function to handle the login page ('/login' Route)
export function loginPage(req, res) {
  // If game has already started and user is not a player, prevent login
  if (gameStarted) {
      if (req.session.playerName && players.includes(req.session.playerName)) {
          return res.redirect('/waiting'); // if returning player, go to waiting room
      } else if (req.session.id === hostSessionId) {
          return res.redirect('/game'); // if host, go directly to the game board view
      } else {
          return res.send("Sorry, the game has already started!"); // new players should not join if game has started already
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


// submit player name and redirect to a waiting page 
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
  
  // Redirect to waiting page
  res.redirect('/waiting');
}


// waiting page after player submits name (wait for game to start)
export function waitingPage(req, res) {
  if (req.session.playerName && players.includes(req.session.playerName)) {
      // if user is registered player
      res.render('waiting', { playerName: req.session.playerName });
  } else {
      // redirect to login page if player is not yet registered
      res.redirect('/login');
  }
}


// get current player count
export function getPlayerCount(req, res) {
  res.json({ count: players.length, players: players });
}


// game page for host and each player
export function gamePage(req, res) {
  // if game has not yet started --> redirect to qr home page
  if (!gameStarted) {
    return res.redirect('/');
  }
  
  // load the host-game view if a host
  if (req.session.id === hostSessionId) {
    return res.render('host-game', { 
      players,
      currentTurn: getCurrentTurn()
    });
  }
  
  // if a player has not registered, redirect them to login page
  const playerName = req.session.playerName;
  if (!playerName || !players.includes(playerName)) {
    return res.redirect('/login');
  }
  
  // load game view for each player
  res.render('game', { 
    playerName,
    playerCards: playerCards[playerName] || [],
    currentTurn: getCurrentTurn(),
    suspects: cards.suspects,
    weapons: cards.weapons,
    rooms: cards.rooms,
    playerEliminatedCards: playerEliminatedCards[playerName] || []
  });
  }


// Start game
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

  console.log(solution)
  
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


// Returns the player whose turn it currently is
function getCurrentTurn() {
  return turnOrder.length > 0 ? turnOrder[currentTurnIndex] : null;
}


// Start the turn rotation when the game begins
function startTurnRotation() {
  // Clear any previous turn order and initialize with current players
  turnOrder.length = 0;
  turnOrder.push(...players);
  currentTurnIndex = 0;
  console.log(`Turn rotation started. First turn: ${turnOrder[currentTurnIndex]}`);
  // Begin the first turn
  advanceTurn();
}


// Advances to the next player's turn, automatically after a timeout
function advanceTurn() {
  if (turnOrder.length === 0) return;
  
  currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;

  // Log the current turn for debugging
  console.log(`It's now ${turnOrder[currentTurnIndex]}'s turn.`);
  
  // Set a timeout to automatically advance to the next player's turn after 2 minutes
  if (turnTimeout) {
    clearTimeout(turnTimeout);
  }
  
  turnTimeout = setTimeout(() => {
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    console.log(`Turn timed out. Next turn: ${turnOrder[currentTurnIndex]}`);
    advanceTurn();
  }, 2 * 60 * 1000); // 2 minutes in milliseconds
}


// Call this function when a player successfully completes their move
// to manually advance the turn before the timeout expires
function manualAdvanceTurn() {
  if (turnTimeout) {
    clearTimeout(turnTimeout);
  }
  currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
  console.log(`Manually advancing turn. Next turn: ${turnOrder[currentTurnIndex]}`);
  advanceTurn();
}


// Submit a suggestion during a player's turn
export function submitSuggestion(req, res) {
  console.log('SUBMITTED')
  
  const { suspect, weapon, room } = req.body;
  const playerName = req.session.playerName;

  // Validate the suggestion
  if (!gameStarted || playerName !== getCurrentTurn()) {
    return res.status(403).json({ success: false, message: "It's not your turn" });
  }

  // Create the suggestion
  currentSuggestion = { 
    suggester: playerName, 
    suspect, 
    weapon, 
    room,
    refutedBy: null,
    responseHistory: []
  };

  // Always redirect back to game page immediately
  res.json({
    success: true,
    message: "Suggestion submitted. Waiting for responses...",
    redirect: '/game'
  });
}


// Respond to a suggestion (show a card or pass)
export function respondToSuggestion(req, res) {
  const { card } = req.body;
  const playerName = req.session.playerName;

  // Validate the response
  if (!currentSuggestion) {
    return res.status(403).json({ success: false, message: "No active suggestion" });
  }

  // Add this player to the response history
  if (!currentSuggestion.responseHistory) {
    currentSuggestion.responseHistory = [];
  }
  currentSuggestion.responseHistory.push(playerName);

  // If player showed a card
  if (card) {
    // Check if the player can actually show this card
    const playerMatchingCards = playerCards[playerName].filter(
      c => c === currentSuggestion.suspect || 
           c === currentSuggestion.weapon || 
           c === currentSuggestion.room
    );
  
    if (!playerMatchingCards.includes(card)) {
      return res.status(403).json({ success: false, message: "Invalid card" });
    }
  
    // Update suggestion with refutal
    currentSuggestion.refutedBy = {
      player: playerName,
      card: card
    };
    
    // Update suggester's eliminated cards
    const suggester = currentSuggestion.suggester;
    if (!playerEliminatedCards[suggester]) {
      playerEliminatedCards[suggester] = [];
    }
    
    // The refuting player showed them one card, so the other two can be added to eliminated list
    const remainingCards = [currentSuggestion.suspect, currentSuggestion.weapon, currentSuggestion.room]
      .filter(c => c !== card);
      
    remainingCards.forEach(c => {
      if (!playerEliminatedCards[suggester].includes(c)) {
        playerEliminatedCards[suggester].push(c);
      }
    });
    
    // Advance turn to the original suggester
    setTimeout(() => {
      currentTurnIndex = turnOrder.indexOf(currentSuggestion.suggester);
      currentSuggestion = null; // Clear the suggestion
      advanceTurn();
    }, 1000);
    
    return res.json({ 
      success: true, 
      message: "Card shown" 
    });
  } 
  else {
    // Player passed (couldn't show a card)
    
    // Find next player who should respond
    const suggesterIndex = players.indexOf(currentSuggestion.suggester);
    let currentIndex = players.indexOf(playerName);
    let nextIndex = (currentIndex + 1) % players.length;
    
    // If we've gone all the way around to the suggester
    if (nextIndex === suggesterIndex) {
      currentSuggestion.noRefute = true;
      
      // Advance turn to the suggester
      setTimeout(() => {
        currentTurnIndex = suggesterIndex;
        currentSuggestion = null; // Clear the suggestion
        advanceTurn();
      }, 3000);
      
      return res.json({ 
        success: true, 
        message: "No one could refute" 
      });
    }
    
    return res.json({ 
      success: true, 
      message: "Passed to next player" 
    });
  }
}

  // Get eliminated cards for a player
  export function getEliminatedCards(req, res) {
    const playerName = req.session.playerName;
    res.json({ 
      eliminatedCards: playerEliminatedCards[playerName] || [],
      currentSuggestion: currentSuggestion
    });
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

// route to render the response page
export function respondPage(req, res) {
  if (!gameStarted || !currentSuggestion) {
      return res.redirect('/game');
  }
  
  const playerName = req.session.playerName;
  if (!playerName || !players.includes(playerName)) {
      return res.redirect('/login');
  }
  
  // Find matching cards that this player can use to refute
  const matchingCards = playerCards[playerName].filter(card => 
      card === currentSuggestion.suspect || 
      card === currentSuggestion.weapon || 
      card === currentSuggestion.room
  );
  
  res.render('respond', { 
      playerName,
      suggestion: currentSuggestion,
      matchingCards,
      suspects: cards.suspects,
      weapons: cards.weapons,
      rooms: cards.rooms
  });
}


// check if it's the player's turn to respond to a suggestion
export function checkResponseTurn(req, res) {
  const playerName = req.session.playerName;
  
  if (!gameStarted || !currentSuggestion || !playerName) {
      return res.json({ shouldRespond: false });
  }
  
  // Calculate which player should respond next
  const suggesterIndex = players.indexOf(currentSuggestion.suggester);
  let currentIndex = suggesterIndex;
  let responded = [];
  
  // If we have a response history, use it
  if (currentSuggestion.responseHistory) {
      responded = currentSuggestion.responseHistory;
  }
  
  // Find the next player who hasn't responded yet
  do {
      currentIndex = (currentIndex + 1) % players.length;
      if (currentIndex === suggesterIndex) {
          // We've gone all the way around, no one can refute
          return res.json({ shouldRespond: false });
      }
  } while (responded.includes(players[currentIndex]));
  
  // Check if it's this player's turn to respond
  const shouldRespond = (players[currentIndex] === playerName);
  
  if (shouldRespond) {
      res.json({ shouldRespond: true });
  } else {
      res.json({ shouldRespond: false });
  }
}

// check the current status of a suggestion
export function checkSuggestionStatus(req, res) {
  // If no current suggestion or it's been refuted, the suggestion process is resolved
  const resolved = !currentSuggestion || currentSuggestion.refutedBy || currentSuggestion.noRefute;
  res.json({ resolved });
}

// function to handle the suggestion page
export function makeSuggestionPage(req, res) {
  // If game has not yet started, redirect to home
  if (!gameStarted) {
    return res.redirect('/');
  }

  const playerName = req.session.playerName;

  // If not a valid player, redirect to login
  if (!playerName || !players.includes(playerName)) {
    return res.redirect('/login');
  }

  // If it's not this player's turn, redirect to game page
  if (playerName !== getCurrentTurn()) {
    return res.redirect('/game');
  }

  if (
    currentSuggestion &&
    currentSuggestion.suggester === playerName &&
    !currentSuggestion.resolved
  ) {
    return res.redirect('/game');
  }

  // Render the make suggestion page
  res.render('make-suggestion', {
    playerName,
    suspects: cards.suspects,
    weapons: cards.weapons,
    rooms: cards.rooms,
    playerEliminatedCards: playerEliminatedCards[playerName] || []
  });
}


export function getGameStatus(req, res) {
  res.json({
    gameStarted,
    currentTurn: getCurrentTurn(),
    players,
    gameOver,
    winner
  });
}

// Render the Flappy Bird game page
export function flappyBird(req, res) {
  res.render('flappy', { title: 'Flappy Bird Game' });
}

// Render the Flappy Bird game page
export function doodle(req, res) {
  res.render('doodle', { title: 'Doodle Jump Game' });
}

// clear suggestion function
export function clearSuggestion(req, res) {
  // Only allow the suggester to clear the suggestion
  if (currentSuggestion && req.session.playerName === currentSuggestion.suggester) {
      currentSuggestion = null;
  }
  res.json({ success: true });
}

// New function to handle suggestion resolution on the backend
export function resolveSuggestion(req, res) {
  const playerName = req.session.playerName;
  
  // Only the suggester can resolve their own suggestion
  if (!currentSuggestion || currentSuggestion.suggester !== playerName) {
    return res.status(403).json({ 
      success: false, 
      message: "No active suggestion or not your suggestion to resolve" 
    });
  }
  
  let result = {
    success: true,
    resolved: true,
    message: ""
  };
  
  // Handle the suggestion resolution based on state
  if (currentSuggestion.refutedBy) {
    const refuter = currentSuggestion.refutedBy.player;
    const card = currentSuggestion.refutedBy.card;
    
    result.refuted = true;
    result.refutedBy = refuter;
    result.card = card;
    result.message = `${refuter} has refuted your suggestion by showing you: ${card}`;
    
    // Update suggester's eliminated cards
    if (!playerEliminatedCards[playerName]) {
      playerEliminatedCards[playerName] = [];
    }
    
    // The refuting player showed them one card, so the other two can be added to eliminated list
    const remainingCards = [currentSuggestion.suspect, currentSuggestion.weapon, currentSuggestion.room]
      .filter(c => c !== card);
      
    remainingCards.forEach(c => {
      if (!playerEliminatedCards[playerName].includes(c)) {
        playerEliminatedCards[playerName].push(c);
      }
    });
  } 
  else if (currentSuggestion.noRefute) {
    result.noRefute = true;
    result.message = "No one could refute your suggestion!";
  }
  else {
    // Suggestion is still in progress
    return res.json({ 
      success: true,
      resolved: false,
      message: "Waiting for players to respond to your suggestion..."
    });
  }
  
  // Clear the suggestion after processing
  setTimeout(() => {
    currentSuggestion = null;
    // Advance the turn now that the suggestion is resolved
    advanceTurn();
  }, 1000);
  
  res.json(result);
}

/* ----------------------------------------------------------------------------------- */


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
    getCurrentPlayer,
    submitSuggestion, 
    respondToSuggestion, 
    getEliminatedCards,
    startTurnRotation, 
    advanceTurn,
    getCurrentTurn,
    manualAdvanceTurn,
    respondPage,
    checkResponseTurn,
    checkSuggestionStatus,
    getGameStatus,
    makeSuggestionPage,
    flappyBird,
    doodle,
    clearSuggestion,
    resolveSuggestion
};