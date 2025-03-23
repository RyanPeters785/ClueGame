import express from 'express';
import path from 'path';
import os from 'os';
import qrUtils from './utils/qrUtils.js';
import gameController from './controllers/gameController.js';
import open from 'open';
const app = express();
const port = 3000;

// Set up the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing the request body
app.use(express.urlencoded({ extended: true }));

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
};

const localIP = getLocalIP();

// Routes
app.get('/', (req, res) => {
    const qrData = `http://${localIP}:${port}/login`; // Dynamic URL based on local IP
    qrUtils.generateQRCode(qrData, (qrCodeUrl) => { 
        if (qrCodeUrl) {
            res.render('index', { qrCodeUrl });
        } else {
            res.status(500).send("Failed to generate QR code");
        }
    });
});

app.get('/login', gameController.loginPage);
app.post('/login', gameController.submitName);

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://${localIP}:${port}`);
    
    // Open the QR page automatically in the default browser
    open(`http://${localIP}:${port}`);
});
