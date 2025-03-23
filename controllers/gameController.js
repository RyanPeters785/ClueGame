// handles logic for generating pages
const qrUtils = require('../utils/qrUtils');
let playerName = null;

// Home page with QR code
exports.home = (req, res) => {
    const qrData = 'http://localhost:3000/login'; // URL for the login page
    const qrCodePath = qrUtils.generateQRCode(qrData); // Generate the QR code image
    res.render('index', { qrCodePath });
};

// Login page for entering player name
exports.loginPage = (req, res) => {
    res.render('login');
};

// Submit player name and redirect to a game page (or another step)
exports.submitName = (req, res) => {
    playerName = req.body.name;
    res.send(`Welcome, ${playerName}! You are ready to play Clue!`);
};
