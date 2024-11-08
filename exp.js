const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const path = require('path');
const app = express();
const port = 8000;
let isClientReady = false;
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10),
    queueLimit: 0
});

// Make sure to handle errors and connections properly
pool.getConnection()
    .then(conn => {
        console.log('Connected to MySQL');
        conn.release();
    })
    .catch(err => {
        console.error('Error connecting to MySQL:', err);
    });
 

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "my-client-id" }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    },
    logger: console,
});

client.on('qr', qr => {
    console.log('QR Code received. Scan the QR code below:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    isClientReady = true;
});

client.on('authenticated', () => {
    console.log('WhatsApp client authenticated!');
});

client.on('auth_failure', (message) => {
    console.error('Authentication failure:', message);
});

client.initialize();

function formatPhoneNumber(number) {
    number = number.replace(/\D/g, '');
    if (number.startsWith('08')) {
        number = '628' + number.slice(2);
    }
    if (number.startsWith('62')) {
        number = '62' + number.slice(2);
    }
    return number;
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));


app.post('/send-message', async (req, res) => {
    const { number, message, media, mediaUrl } = req.body;

    if (!number || (!message && !media && !mediaUrl)) {
        return res.status(400).send({ error: 'Missing number, message, or media parameter' });
    }

    const formattedNumber = formatPhoneNumber(number) + '@c.us';

    try {
        if (mediaUrl) {
            const mediaObject = await MessageMedia.fromUrl(mediaUrl);
            await client.sendMessage(formattedNumber, mediaObject, { caption: message });
        } else if (media) {
            const mediaObject = MessageMedia.fromFilePath(media);
            await client.sendMessage(formattedNumber, mediaObject, { caption: message });
        } else {
            await client.sendMessage(formattedNumber, message);
        }

        res.status(200).send({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send({ error: 'Failed to send message' });
    }
});
app.post('/send-message-reset', async (req, res) => {
    const { nis } = req.body;

    if (!nis) {
        return res.status(400).send({ error: 'Missing NIS parameter' });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        
        const [rows] = await connection.execute('SELECT phone FROM userbaru WHERE nis = ?', [nis]);
        if (rows.length === 0) {
            return res.status(404).send({ error: 'NIS not found' });
        }

        const phone = rows[0].phone;
        const currentHour = new Date().getHours();
        let greeting;
        if (currentHour >= 0 && currentHour < 12) {
            greeting = 'Selamat Pagi';
        } else if (currentHour >= 12 && currentHour < 18) {
            greeting = 'Selamat Siang';
        } else {
            greeting = 'Selamat Malam';
        }

        const token = ('000' + Math.floor(Math.random() * 999)).slice(-3);
        await connection.execute('UPDATE userbaru SET token = ? WHERE nis = ?', [token, nis]);

        const message = `${greeting}, Silakan masukkan token *${token}* ke website register http://cbt.sman81.sch.id:8000/reset`;
        const formattedNumber = formatPhoneNumber(phone) + '@c.us';

        try {
            await client.sendMessage(formattedNumber, message);
            res.status(200).send({ success: true, message: 'Message sent successfully' });
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).send({ error: 'Failed to send message' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    } finally {
        if (connection) connection.release();
    }
});
 

app.get('/hehe', (req, res) => {  
    res.sendFile(path.join(__dirname, 'static', 'hehe.html'));
});
app.get('/rahasia', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html')); 
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'reset.html'));  
});
    
app.get('/status', (req, res) => {
    res.json({ isClientReady });
});

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    let connection;

    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT * FROM messages ORDER BY id DESC LIMIT ?', [limit]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).send({ error: 'Failed to fetch messages' });
    } finally {
        if (connection) connection.release();
    }
});
 

app.listen(port, '0.0.0.0', () => {
    console.log(`API server running at http://localhost:${port}`);
});
client.on('message', async (msg) => {
    const now = new Date();
    const hour = now.getHours();
      //suka tetiba muncul
      if (msg.from === 'status@broadcast') {
        return;
    } 

    if (msg.body.startsWith('/send-message')) {
        return;
    }

     if (hour < 7 || hour >= 16) {    
if (hour < 3) {
    const reply = "Selamat Tengah Malam, Mohon ditunggu, di luar jam kerja (16.00), akan kami jawab di hari berikutnya";
    await client.sendMessage(msg.from, reply);
} else if (hour < 7) {
    const reply = "Selamat Pagi, Mohon ditunggu, di luar jam kerja (06.30), akan kami jawab nanti saat operator bekerja";
    await client.sendMessage(msg.from, reply);
} else if (hour >= 16 && hour < 18) {
    const reply = "Selamat Sore, Mohon ditunggu, di luar jam kerja (16.00), akan kami jawab di hari berikutnya";
    await client.sendMessage(msg.from, reply);
} else if (hour >= 18 && hour < 24) {
    const reply = "Selamat Malam, Mohon ditunggu, di luar jam kerja (16.00), akan kami jawab di hari berikutnya";
    await client.sendMessage(msg.from, reply);
}
        const sql = 'INSERT INTO messages (number, content, timestamp, replied) VALUES (?, ?, ?, ?)';
        db.query(sql, [msg.from, msg.body, now, false], (err, result) => {
            if (err) throw err;
            console.log('Message saved to database');
        });
    }
});
