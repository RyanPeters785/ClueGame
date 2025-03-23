import QRCode from 'qrcode';

// Generate QR code and return as base64 string
export function generateQRCode(data, callback) {
    QRCode.toDataURL(data, (err, url) => {
        if (err) {
            console.error("Error generating QR code", err);
            callback(null); // Pass null if error occurs
            return;
        }
        callback(url); // Return the base64 encoded image URL
    });
}

export default { generateQRCode };