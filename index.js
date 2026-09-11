const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const puppeteer = require('puppeteer');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: puppeteer.executablePath(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote'
        ]
    }
});
// Estado del torneo
let torneo = {
    activo: false,
    jugadores: [], // Objetos { id: '12345@c.us', nombre: 'Juan' }
    ronda: '', // 'inscripción', 'cuartos', 'semis', 'final', 'terminado'
    partidos: [],
    ganadoresRonda: []
};

// Control de Spam y Baneos
const historialMensajes = new Map();
const usuariosBaneados = new Set();
const LIMITE_MENSAJES = 5;
const VENTANA_TIEMPO_MS = 5000;

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea el código QR con tu WhatsApp Business.');
});

client.on('ready', () => {
    console.log('El bot de torneos está listo.');
});

client.on('message', async (msg) => {
    const usuarioId = msg.author || msg.from;
    const texto = msg.body.trim();

    // 1. Ignorar usuarios baneados
    if (usuariosBaneados.has(usuarioId)) return;

    // 2. Detección de Links
    const regexLinks = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|edu|gov|io|me|co|app|info|xyz|dev))/i;
    if (regexLinks.test(texto)) {
        banearUsuario(usuarioId, msg, 'Envío de enlaces no autorizados (Spam)');
        return;
    }

    // 3. Control de Flooding (Spam rápido)
    const ahora = Date.now();
    if (!historialMensajes.has(usuarioId)) historialMensajes.set(usuarioId, []);
    const timestamps = historialMensajes.get(usuarioId).filter(t => ahora - t < VENTANA_TIEMPO_MS);
    timestamps.push(ahora);
    historialMensajes.set(usuarioId, timestamps);

    if (timestamps.length > LIMITE_MENSAJES) {
        banearUsuario(usuarioId, msg, 'Exceso de mensajes (Flooding/Spam)');
        return;
    }

    // --- COMANDOS ---
    const comando = texto.split(' ')[0].toLowerCase();
    const parametro = texto.split(' ').slice(1).join(' ');

    if (comando === '!torneo') {
        torneo = {
            activo: true,
            jugadores: [],
            ronda: 'inscripción',
            partidos: [],
            ganadoresRonda: []
        };
        await msg.reply('🏆 *¡Torneo de 8 personas iniciado!*\nEscribe *!yo* para inscribirte.');
        return;
    }

    if (!torneo.activo) return;

    if (comando === '!yo') {
        if (torneo.ronda !== 'inscripción') {
            await msg.reply('Las inscripciones ya están cerradas.');
            return;
        }

        const yaInscrito = torneo.jugadores.some(j => j.id === usuarioId);
        if (yaInscrito) {
            await msg.reply('Ya estás inscrito en el torneo.');
            return;
        }

        if (torneo.jugadores.length >= 8) {
            await msg.reply('Los 8 cupos ya están llenos.');
            return;
        }

        const contacto = await msg.getContact();
        const nombre = contacto.pushname || contacto.name || `@${usuarioId.split('@')[0]}`;

        torneo.jugadores.push({ id: usuarioId, nombre: nombre });
        await msg.reply(`✅ *${nombre}* te has inscrito (${torneo.jugadores.length}/8).`);

        if (torneo.jugadores.length === 8) {
            iniciarCuartos(msg);
        }
        return;
    }

    if (comando === '!poner') {
        if (torneo.ronda !== 'inscripción') {
            await msg.reply('Las inscripciones ya están cerradas.');
            return;
        }

        const menciones = await msg.getMentions();
        if (menciones.length === 0) {
            await msg.reply('Debes etiquetar a alguien. Ejemplo: *!poner @usuario*');
            return;
        }

        const objetivo = menciones[0];
        const objetivoId = objetivo.id._serialized;
        const nombreObj = objetivo.pushname || objetivo.name || `@${objetivoId.split('@')[0]}`;

        if (torneo.jugadores.some(j => j.id === objetivoId)) {
            await msg.reply(`${nombreObj} ya se encuentra registrado.`);
            return;
        }

        if (torneo.jugadores.length >= 8) {
            await msg.reply('Los 8 cupos ya están completos.');
            return;
        }

        torneo.jugadores.push({ id: objetivoId, nombre: nombreObj });
        await msg.reply(`✅ *${nombreObj}* fue añadido por el administrador (${torneo.jugadores.length}/8).`);

        if (torneo.jugadores.length === 8) {
            iniciarCuartos(msg);
        }
        return;
    }

    if (comando === '!quitar') {
        if (torneo.ronda !== 'inscripción') {
            await msg.reply('No se pueden quitar jugadores una vez iniciadas las llaves.');
            return;
        }

        const menciones = await msg.getMentions();
        if (menciones.length === 0) {
            await msg.reply('Debes etiquetar a la persona que deseas quitar. Ejemplo: *!quitar @usuario*');
            return;
        }

        const objetivoId = menciones[0].id._serialized;
        const existe = torneo.jugadores.some(j => j.id === objetivoId);

        if (!existe) {
            await msg.reply('El usuario mencionado no está en la lista de inscritos.');
            return;
        }

        torneo.jugadores = torneo.jugadores.filter(j => j.id !== objetivoId);
        await msg.reply(`🗑️ Usuario eliminado. Cupos restantes: (${torneo.jugadores.length}/8).`);
        return;
    }

    if (comando === '!resultado') {
        if (torneo.ronda === 'inscripción' || torneo.ronda === 'terminado') {
            await msg.reply('No hay partidas activas.');
            return;
        }
        if (!parametro) {
            await msg.reply('Indica el nombre del ganador. Ejemplo: *!resultado Nombre*');
            return;
        }

        procesarGanador(msg, parametro);
        return;
    }

    if (comando === '!estado') {
        mostrarEstado(msg);
        return;
    }
});

function iniciarCuartos(msg) {
    torneo.ronda = 'cuartos';
    const lista = [...torneo.jugadores].sort(() => Math.random() - 0.5);
    
    torneo.partidos = [
        { id: 1, j1: lista[0].nombre, j2: lista[1].nombre, ganador: null },
        { id: 2, j1: lista[2].nombre, j2: lista[3].nombre, ganador: null },
        { id: 3, j1: lista[4].nombre, j2: lista[5].nombre, ganador: null },
        { id: 4, j1: lista[6].nombre, j2: lista[7].nombre, ganador: null }
    ];
    torneo.ganadoresRonda = [];

    let respuesta = '🔥 *CUARTOS DE FINAL DEFINIDOS*\n\n';
    torneo.partidos.forEach(p => {
        respuesta += `Mesa ${p.id}: ${p.j1} vs ${p.j2}\n`;
    });
    respuesta += '\nUsa *!resultado <Ganador>* para avanzar.';
    msg.reply(respuesta);
}

function procesarGanador(msg, ganadorNom) {
    const partido = torneo.partidos.find(p => 
        !p.ganador && (p.j1.toLowerCase() === ganadorNom.toLowerCase() || p.j2.toLowerCase() === ganadorNom.toLowerCase())
    );

    if (!partido) {
        msg.reply('Jugador no encontrado en los enfrentamientos pendientes.');
        return;
    }

    const nombreReal = partido.j1.toLowerCase() === ganadorNom.toLowerCase() ? partido.j1 : partido.j2;
    partido.ganador = nombreReal;
    torneo.ganadoresRonda.push(nombreReal);

    msg.reply(`🎉 *${nombreReal}* avanza a la siguiente ronda.`);

    if (torneo.ganadoresRonda.length === torneo.partidos.length) {
        avanzarSiguienteRonda(msg);
    }
}

function avanzarSiguienteRonda(msg) {
    const ganadores = [...torneo.ganadoresRonda];
    torneo.ganadoresRonda = [];

    if (torneo.ronda === 'cuartos') {
        torneo.ronda = 'semis';
        torneo.partidos = [
            { id: 1, j1: ganadores[0], j2: ganadores[1], ganador: null },
            { id: 2, j1: ganadores[2], j2: ganadores[3], ganador: null }
        ];

        let resp = '⚔️ *SEMIFINALES*\n\n';
        resp += `Semifinal 1: ${ganadores[0]} vs ${ganadores[1]}\n`;
        resp += `Semifinal 2: ${ganadores[2]} vs ${ganadores[3]}\n`;
        msg.reply(resp);

    } else if (torneo.ronda === 'semis') {
        torneo.ronda = 'final';
        torneo.partidos = [
            { id: 1, j1: ganadores[0], j2: ganadores[1], ganador: null }
        ];

        let resp = '👑 *GRAN FINAL*\n\n';
        resp += `Final: ${ganadores[0]} vs ${ganadores[1]}\n`;
        msg.reply(resp);

    } else if (torneo.ronda === 'final') {
        torneo.ronda = 'terminado';
        torneo.activo = false;
        msg.reply(`🏆 *¡EL CAMPEÓN DEL TORNEO ES ${ganadores[0]}!* 🏆`);
    }
}

function mostrarEstado(msg) {
    if (torneo.ronda === 'inscripción') {
        const listaNombres = torneo.jugadores.map(j => j.nombre).join(', ');
        msg.reply(`Jugadores inscritos (${torneo.jugadores.length}/8):\n` + (listaNombres || 'Ninguno aún'));
        return;
    }
    let resp = `Estado actual (${torneo.ronda.toUpperCase()}):\n\n`;
    torneo.partidos.forEach(p => {
        const estado = p.ganador ? `(Ganó: ${p.ganador})` : 'Pendiente';
        resp += `${p.j1} vs ${p.j2} -> ${estado}\n`;
    });
    msg.reply(resp);
}

function banearUsuario(usuarioId, msg, razon) {
    usuariosBaneados.add(usuarioId);
    torneo.jugadores = torneo.jugadores.filter(j => j.id !== usuarioId);
    msg.reply(`⛔ *USUARIO BANEADO*\n\nMotivo: ${razon}.\nSancionado y eliminado del torneo.`);
}

client.initialize();

// Servidor Web para Render (Evita suspensiones)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send('Bot de WhatsApp Torneos Activo 24/7');
});
app.listen(PORT, () => {
    console.log(`Servidor web corriendo en el puerto ${PORT}`);
});