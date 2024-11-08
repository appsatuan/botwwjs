const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
const port = 8000;
const { Client, LocalAuth } = require('whatsapp-web.js');
const mysql = require('mysql2');
const path = require('path');

// Initialize the WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: "remote",
        remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
    },
    puppeteer: {
        args: ['--no-sandbox'],
    }
});

// Event listener for QR code
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Event listener when client is ready
client.on('ready', () => {
    console.log('Client is ready!');
});

// Initialize WhatsApp client
client.initialize();

// Set up middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MySQL connection setup
const connection = mysql.createConnection({
    host: '127.0.0.1', // Replace with your MySQL host
    user: 'web', // Replace with your MySQL username 
    password: 'xcpass', // Replace with your MySQL password
    database: 'dbci3' // Replace with your MySQL database name 
});

// Connect to the MySQL database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Function to fetch phone numbers from the database
const fetchPhoneNumbers = () => {
    return new Promise((resolve, reject) => {
        const query = 'SELECT phone_ortu FROM ppdb_siswa';
        connection.query(query, (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results.map(row => row.phone_ortu));
        });
    });
};

// Function to format phone numbers
function formatNumber(number) {
    if (typeof number !== 'string') {
        throw new Error('Number must be a string.');
    }

    if (number.startsWith('08')) {
        console.log('Formatted to 628:', '628' + number.substring(2) + '@c.us');
        return '628' + number.substring(2) + '@c.us';
    } else if (number.startsWith('62')) {
        console.log('Formatted with 62:', number + '@c.us');
        return number + '@c.us';
    } else {
        throw new Error('Invalid number format.');
    }
}

// Endpoint to send a single message
app.post('/send-message', async (req, res) => {
    try {
        const { number, message } = req.body;
        if (!number || !message) {
            return res.status(400).json({ error: 'Number and message are required.' });
        }

        const formattedNumber = formatNumber(number);
        await client.sendMessage(formattedNumber, message);
        res.status(200).json({ success: true, message: 'Message sent successfully.' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint to send bulk messages to all numbers in the database
app.post('/send-bulk-message', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        // Fetch phone numbers from the database
        const phoneNumbers = await fetchPhoneNumbers();

        // Send message to each number
        for (const number of phoneNumbers) {
            try {
                const formattedNumber = formatNumber(number);
                console.log('Sending message to:', formattedNumber);
                await client.sendMessage(formattedNumber, message);
            } catch (error) {
                console.error(`Error sending message to ${number}:`, error);
            }
        }

        res.status(200).json({ success: true, message: 'Messages sent successfully.' });
    } catch (error) {
        console.error('Error sending bulk messages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Serve the HTML file for the web interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Whatsapp Web on port ${port}`);
});
