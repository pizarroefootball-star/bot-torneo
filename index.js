const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 10000;

let qrCodeDataUrl = '';
let clientReady = false;

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

client.on('qr', async (qr) => {
    console.log('Generando nuevo código QR para la web...');
    try {
        qrCodeDataUrl = await qrcode.toDataURL(qr);
    } catch (err) {
        console.error('Error al generar QR:', err);
    }
});

client.on('ready', () => {
    clientReady = true;
    qrCodeDataUrl = '';
    console.log('¡Bot de WhatsApp conectado y listo!');
});

client.on('message', async (msg) => {
    if (msg.body === '!ping') {
        await msg.reply('¡Pong! El bot está en línea y funcionando 🚀');
    }
});

app.get('/', (req, res) => {
    if (clientReady) {
        res.send(`
            <html lang="es">
            <body style="background:#0f172a;color:#fff;font-family:Arial,sans-serif;text-align:center;padding-top:60px;">
                <h1 style="color:#22c55e;">✅ ¡WhatsApp Conectado con Éxito!</h1>
                <p>El bot ya está operando y vinculado a tu cuenta.</p>
            </body>
            </html>
        `);
    } else if (qrCodeDataUrl) {
        res.send(`
            <html lang="es">
            <head>
                <meta http-equiv="refresh" content="15">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Vincular Bot WhatsApp</title>
            </head>
            <body style="background:#0f172a;color:#fff;font-family:Arial,sans-serif;text-align:center;padding-top:20px;">
                <h2>📱 Escanea este Código QR</h2>
                <p style="color:#94a3b8;">Abre WhatsApp Business > Dispositivos vinculados > Vincular un dispositivo</p>
                <div style="background:#fff;display:inline-block;padding:20px;border-radius:12px;margin-top:15px;box-shadow:0 4px 6px rgba(0,0,0,0.3);">
                    <img src="${qrCodeDataUrl}" style="width:280px;height:280px;display:block;"/>
                </div>
                <p style="font-size:12px;color:#64748b;margin-top:15px;">La página se actualizará automáticamente si el QR cambia.</p>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <html lang="es">
            <head>
                <meta http-equiv="refresh" content="5">
            </head>
            <body style="background:#0f172a;color:#fff;font-family:Arial,sans-serif;text-align:center;padding-top:60px;">
                <h2>⏳ Iniciando el navegador en Render...</h2>
                <p style="color:#94a3b8;">Esperando a que se genere el código QR. La página se recargará sola en unos segundos.</p>
            </body>
            </html>
        `);
    }
});

app.listen(port, () => {
    console.log(`Servidor web corriendo en el puerto ${port}`);
});

client.initialize();