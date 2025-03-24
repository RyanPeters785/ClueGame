import express from 'express';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import qrUtils from './utils/qrUtils.js';
import gameController from './controllers/gameController.js';
import open from 'open';
import session from 'express-session';

const app = express();
const port = 3000;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Set up session middleware
app.use(session({
    secret: 'clue-game-secret',
    resave: false,
    saveUninitialized: true
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing the request body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

// Routes
app.get('/', gameController.home);
app.get('/login', gameController.loginPage);
app.post('/login', gameController.submitName);
app.get('/api/players', gameController.getPlayerCount);
app.post('/api/start-game', gameController.startGame);
app.get('/game', gameController.gamePage);

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://${localIP}:${port}`);
    
    // Open the QR page automatically in Chrome browser
    open(`http://${localIP}:${port}`, {app: {name: 'google chrome'}});
});