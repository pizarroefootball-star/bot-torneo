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
// Arreglo para almacenar los participantes inscritos
let participantes = [];
let torneoIniciado = false;

client.on('message', async (msg) => {
    const texto = msg.body.trim();

    // Comando para registrarse al torneo
    if (texto.startsWith('!inscribir')) {
        const nombreJugador = texto.replace('!inscribir', '').trim();
        
        if (!nombreJugador) {
            await msg.reply('❌ Por favor, escribe tu nombre después del comando. Ejemplo: *!inscribir Juan*');
            return;
        }

        if (torneoIniciado) {
            await msg.reply('⚠️ Lo siento, el torneo ya ha comenzado y las inscripciones están cerradas.');
            return;
        }

        if (participantes.includes(nombreJugador)) {
            await msg.reply(`⚠️ ${nombreJugador}, ya estás inscrito en el torneo.`);
            return;
        }

        if (participantes.length < 8) {
            participantes.push(nombreJugador);
            await msg.reply(`✅ ¡Inscripción exitosa, ${nombreJugador}! (${participantes.length}/8 cupos llenos).`);

            // Si se llenan los 8 cupos, genera el torneo automáticamente
            if (participantes.length === 8) {
                torneoIniciado = true;
                await msg.reply('🏆 ¡Cupos llenos! El torneo de 8 jugadores ha comenzado. Aquí están los cruces de cuartos de final:\n\n' +
                    `1️⃣ ${participantes[0]} vs ${participantes[1]}\n` +
                    `2️⃣ ${participantes[2]} vs ${participantes[3]}\n` +
                    `3️⃣ ${participantes[4]} vs ${participantes[5]}\n` +
                    `4️⃣ ${participantes[6]} vs ${participantes[7]}`
                );
            }
        }
    }

    // Comando para ver la lista de inscritos actual
    if (texto === '!lista') {
        if (participantes.length === 0) {
            await msg.reply('📋 No hay participantes inscritos todavía.');
        } else {
            await msg.reply(`📋 *Participantes inscritos (${participantes.length}/8):*\n` + participantes.map((p, i) => `${i + 1}. ${p}`).join('\n'));
        }
    }

    // Comando para reiniciar el torneo (útil para pruebas)
    if (texto === '!reset') {
        participantes = [];
        torneoIniciado = false;
        await msg.reply('🔄 El torneo ha sido reiniciado. Las inscripciones están abiertas de nuevo.');
    }
});