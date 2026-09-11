const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 10000;

let qrCodeUrl = '';
let isClientReady = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('¡Nuevo código QR recibido! Generando imagen web...');
    qrcode.toDataURL(qr, (err, url) => {
        if (!err) {
            qrCodeUrl = url;
        }
    });
});

client.on('ready', () => {
    isClientReady = true;
    qrCodeUrl = '';
    console.log('¡Cliente de WhatsApp listo y vinculado con éxito!');
});

client.on('message', async (msg) => {
    if (msg.body === '!ping') {
        await msg.reply('¡Pong! El bot del torneo está activo 24/7 🚀');
    }
});

app.get('/', (req, res) => {
    if (isClientReady) {
        res.send(`
            <body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
                <h1>✅ ¡El Bot de WhatsApp ya está vinculado y activo!</h1>
                <p>Puedes cerrar esta pestaña. El bot está funcionando correctamente.</p>
            </body>
        `);
    } else if (qrCodeUrl) {
        res.send(`
            <body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding-top:30px;">
                <h2>📱 Escanea el Código QR con WhatsApp Business</h2>
                <p>Abre WhatsApp en tu teléfono > Dispositivos vinculados > Vincular un dispositivo</p>
                <div style="background:white;display:inline-block;padding:15px;border-radius:10px;margin-top:20px;">
                    <img src="${qrCodeUrl}" style="width:300px;height:300px;display:block;"/>
                </div>
            </body>
        `);
    } else {
        res.send(`
            <body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
                <h2>⏳ Iniciando el navegador y generando el QR...</h2>
                <p>Actualiza esta página en unos 15 o 30 segundos.</p>
            </body>
        `);
    }
});

app.listen(port, () => {
    console.log(`Servidor web corriendo en el puerto ${port}`);
});

client.initialize();