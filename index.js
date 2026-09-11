const express = require('express');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 10000;

let qrCodeDataUrl = '';
let clientReady = false;
let participantes = [];
let torneoIniciado = false;

const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', async (qr) => {
    console.log('Generando nuevo código QR...');
    try {
        qrCodeDataUrl = await qrcode.toDataURL(qr);
    } catch (err) {
        console.error('Error al generar QR:', err);
    }
});

client.on('ready', () => {
    clientReady = true;
    qrCodeDataUrl = '';
    console.log('¡Bot conectado y listo!');
});

client.on('message', async (msg) => {
    const texto = msg.body.trim().toLowerCase();
    console.log('Mensaje recibido:', texto);

    if (texto.startsWith('!inscribir')) {
        const nombreJugador = msg.body.replace('!inscribir', '').trim();
        if (!nombreJugador) {
            await msg.reply('❌ Escribe tu nombre. Ejemplo: *!inscribir Juan*');
            return;
        }
        if (torneoIniciado) {
            await msg.reply('⚠️ El torneo ya comenzó.');
            return;
        }
        if (participantes.includes(nombreJugador)) {
            await msg.reply(`⚠️ ${nombreJugador}, ya estás inscrito.`);
            return;
        }
        if (participantes.length < 8) {
            participantes.push(nombreJugador);
            await msg.reply(`✅ ¡Inscrito, ${nombreJugador}! (${participantes.length}/8).`);
            if (participantes.length === 8) {
                torneoIniciado = true;
                await msg.reply('🏆 ¡Cupos llenos! Cruces de cuartos:\n\n' +
                    `1️⃣ ${participantes[0]} vs ${participantes[1]}\n` +
                    `2️⃣ ${participantes[2]} vs ${participantes[3]}\n` +
                    `3️⃣ ${participantes[4]} vs ${participantes[5]}\n` +
                    `4️⃣ ${participantes[6]} vs ${participantes[7]}`
                );
            }
        }
    }

    if (texto === '!lista') {
        if (participantes.length === 0) {
            await msg.reply('📋 No hay participantes inscritos.');
        } else {
            await msg.reply(`📋 *Participantes (${participantes.length}/8):*\n` + participantes.map((p, i) => `${i + 1}. ${p}`).join('\n'));
        }
    }

    if (texto === '!reset') {
        participantes = [];
        torneoIniciado = false;
        await msg.reply('🔄 Torneo reiniciado.');
    }
});

app.get('/', (req, res) => {
    if (clientReady) {
        res.send('<h1 style="color:green;text-align:center;padding-top:50px;">✅ ¡Bot conectado y respondiendo comandos!</h1>');
    } else if (qrCodeDataUrl) {
        res.send(`
            <html lang="es">
            <head><meta http-equiv="refresh" content="10"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="text-align:center;padding-top:20px;">
                <h2>📱 Escanea el QR</h2>
                <img src="${qrCodeDataUrl}" width="280"/>
            </body>
            </html>
        `);
    } else {
        res.send('<h2 style="text-align:center;padding-top:50px;">⏳ Iniciando... recarga en unos segundos.</h2>');
    }
});

app.listen(port, () => {
    console.log(`Servidor en puerto ${port}`);
});

client.initialize();