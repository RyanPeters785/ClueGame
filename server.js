import express from 'express';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import qrUtils from './utils/qrUtils.js';
import gameController from './controllers/gameController.js';
import open from 'open';
import session from 'express-session';

const app = express(); //define web application object
const port = 3000;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url); //converts modeule URL into regular file path
const __dirname = path.dirname(__filename); //extracts directory from the file path

app.set('view engine', 'ejs'); // use Embedded JavaScript to render views
app.set('views', path.join(__dirname, 'views')); //tells the app (express) where to find the EJS files (where the views are)

// Set up session middleware: stores session data on the server for each conncted user as cookies
app.use(session({
    secret: 'clue-game-secret',
    resave: false,
    saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'public'))); // tells app (express) to serve static files (images, CSS, JS) from folder named 'public'

// Middleware for parsing the request body
app.use(express.urlencoded({ extended: true })); // parse HTML form data
app.use(express.json()); // parse JSON 

// Get the local IP address of the server
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (let interfaceName in interfaces) {
        for (let iface of interfaces[interfaceName]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
};
const localIP = getLocalIP();

// Routes: map URLs to controller functions
app.get('/', gameController.home); // qr home page for host
app.get('/login', gameController.loginPage); // shows the login form
app.post('/login', gameController.submitName); // handels form submission 
app.get('/waiting', gameController.waitingPage); // waiting page for players after they login
app.get('/api/players', gameController.getPlayerCount); // get player count
app.post('/api/start-game', gameController.startGame); // start game
app.get('/game', gameController.gamePage); // get game page for players
app.get('/respond', gameController.respondPage);
app.get('/api/check-response-turn', gameController.checkResponseTurn);
app.get('/api/check-suggestion-status', gameController.checkSuggestionStatus);
app.get('/deduction', gameController.deductionPage);
app.post('/api/submit-suggestion', gameController.submitSuggestion);
app.post('/api/respond-suggestion', gameController.respondToSuggestion);
app.get('/api/eliminated-cards', gameController.getEliminatedCards);
app.get('/make-suggestion', gameController.makeSuggestionPage);
app.get('/flappybird', gameController.flappyBird); 
app.get('/doodle', gameController.doodle); 


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://${localIP}:${port}`);
    
    // Open the QR page automatically in Chrome browser
    open(`http://${localIP}:${port}`, {app: {name: 'chrome'}});
});