const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    fetchLatestBaileysVersion,
    Browsers,
    makeCacheableSignalKeyStore // යතුරු ආරක්ෂා කිරීමට එක් කරන ලදී
} = require('@whiskeysockets/baileys');

const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const fs = require('fs');
const P = require('pino');
const config = require('./config');
const qrcode = require('qrcode-terminal');
const { sms } = require('./lib/msg');
const axios = require('axios');
const { File } = require('megajs');
const path = require('path');
const { getBotSettings, readEnv, connectDB } = require('./lib/mongodb');

const ownerNumber = ['94701391585']; 
const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

async function connectToWA() {
    await connectDB();
    try {
        await readEnv();
    } catch (e) {
        console.log("Error reading env:", e);
    }

    let botSettings = getBotSettings();
    let prefix = botSettings.PREFIX || ".";
    
    console.log("Connecting APEX-MD Wa-BOT 🧬...");

    const authPath = path.join(__dirname, 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.ubuntu("Chrome"),
        // Bad MAC Error එක වළක්වන ප්‍රධානම කොටස
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
        },
        version: version,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
    });

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            let reason = lastDisconnect.error?.output?.statusCode;
            console.log('Connection closed. Reason Code:', reason);

            if (reason === DisconnectReason.restartRequired || reason === DisconnectReason.connectionLost || reason === DisconnectReason.timedOut) {
                console.log('Reconnecting immediately...');
                connectToWA();
            } else if (reason === DisconnectReason.loggedOut) {
                console.log('Logged out. Please delete session and scan again.');
            } else {
                console.log('Connection closed, trying to reconnect...');
                connectToWA();
            }
        } else if (connection === 'open') {
            console.log('APEX-MD connected to WhatsApp ✅');
            
            console.log('⬇️ Installing APEX-MD Plugins...');
            const pluginDir = path.join(__dirname, 'plugins');
            if (fs.existsSync(pluginDir)) {
                fs.readdirSync(pluginDir).forEach(file => {
                    if (file.endsWith('.js')) {
                        try {
                            require(path.join(pluginDir, file));
                        } catch (e) {
                            console.error(`Error loading plugin ${file}:`, e);
                        }
                    }
                });
                console.log('APEX-MD Plugins installed successful ✅');
            }

            if (ownerNumber.length > 0) {
                let up = `*APEX-MD connected successful ✅*\n\n*PREFIX:* ${prefix}\n*MODE:* ${botSettings.MODE || 'public'}`;
                await conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", { 
                    image: { url: botSettings.ALIVE_IMG || "https://telegra.ph/file/2a1389884489b4f494677.jpg" },
                    caption: up 
                });
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mekEvent) => {
        const mek = mekEvent.messages[0];
        if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;
        if (mek.key.remoteJid.includes('@lid') || mek.message.protocolMessage) return;

        const m = sms(conn, mek);
        if (!m || !m.type) return;

        botSettings = getBotSettings();
        prefix = botSettings.PREFIX || ".";

        const body = m.body || '';
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');
        const from = m.chat;
        const sender = m.sender;
        const pushname = m.pushName || 'User';
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const isMe = senderNumber === botNumber;
        const isOwner = ownerNumber.includes(senderNumber) || isMe;
        const botNumber2 = await jidNormalizedUser(conn.user.id);

        const groupMetadata = m.isGroup ? await conn.groupMetadata(from).catch(() => null) : null;
        const groupName = groupMetadata ? groupMetadata.subject : '';
        const participants = groupMetadata ? groupMetadata.participants : [];
        const groupAdmins = m.isGroup ? getGroupAdmins(participants) : [];
        const isBotAdmins = m.isGroup ? groupAdmins.includes(botNumber2) : false;
        const isAdmins = m.isGroup ? groupAdmins.includes(sender) : false;

        const reply = (teks) => conn.sendMessage(from, { text: teks }, { quoted: mek });

        // මුල් කෝඩ් එකේ තිබුණු sendFileUrl Function එක
        conn.sendFileUrl = async (jid, url, caption, quotedMsg, options = {}) => {
            let mime = '';
            try {
                const headRes = await axios.head(url, { timeout: 5000 });
                mime = headRes.headers['content-type'];
                const buffer = await getBuffer(url);
                const fileNameFromUrl = path.basename(new URL(url).pathname);

                if (mime.split("/")[0] === "image" && mime.split("/")[1] === "gif") {
                    return conn.sendMessage(jid, { video: buffer, caption: caption, gifPlayback: true, ...options }, { quoted: quotedMsg });
                }
                if (mime === "application/pdf") {
                    return conn.sendMessage(jid, { document: buffer, mimetype: 'application/pdf', fileName: caption || "document.pdf", caption: caption, ...options }, { quoted: quotedMsg });
                }
                if (mime.startsWith("image/")) {
                    return conn.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted: quotedMsg });
                }
                if (mime.startsWith("video/")) {
                    return conn.sendMessage(jid, { video: buffer, caption: caption, mimetype: mime, ...options }, { quoted: quotedMsg });
                }
                if (mime.startsWith("audio/")) {
                    return conn.sendMessage(jid, { audio: buffer, mimetype: mime, ...options }, { quoted: quotedMsg });
                }
                return conn.sendMessage(jid, { document: buffer, mimetype: mime, caption: caption, fileName: fileNameFromUrl, ...options }, { quoted: quotedMsg });
            } catch (error) {
                console.error("Error in sendFileUrl:", error);
            }
        };

        const currentWorkMode = (botSettings.MODE || 'public').toLowerCase();
        if (currentWorkMode === 'private' && !isOwner) return;
        if (currentWorkMode === 'inbox' && !isOwner && m.isGroup) return;
        if (currentWorkMode === 'groups' && !m.isGroup && !isOwner) return;

        const events = require('./command');
        const cmd = events.commands.find((c) => c.pattern === command) || events.commands.find((c) => c.alias && c.alias.includes(command));

        if (cmd) {
            if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
            try {
                await cmd.function(conn, mek, m, { 
                    from, prefix, q, args, isGroup: m.isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, 
                    groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply 
                });
            } catch (e) {
                console.error(`[PLUGIN ERROR] ${command}:`, e);
            }
        } else if (body) {
            events.commands.forEach(async (cmdObject) => {
                if (cmdObject.on) {
                    const commonParams = { from, prefix, q, args, isGroup: m.isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply };
                    try {
                        if (cmdObject.on === "body") cmdObject.function(conn, mek, m, commonParams);
                        else if (cmdObject.on === "text" && q) cmdObject.function(conn, mek, m, commonParams);
                    } catch (e) { /* silent error for on-body events */ }
                }
            });
        }
    });
}

async function startBot() {
    const authDir = path.join(__dirname, 'auth_info_baileys');
    const credsFile = path.join(authDir, 'creds.json');

    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    if (fs.existsSync(credsFile)) {
        connectToWA();
    } else if (config.SESSION_ID) {
        console.log("Downloading session from MEGA...");
        try {
            const file = File.fromURL(`https://mega.nz/file/${config.SESSION_ID.trim()}`);
            file.download((err, data) => {
                if (!err) {
                    fs.writeFileSync(credsFile, data);
                    console.log("Session downloaded ✅");
                    connectToWA();
                } else {
                    console.error("Mega download failed.");
                    connectToWA();
                }
            });
        } catch (e) {
            connectToWA();
        }
    } else {
        connectToWA();
    }
}

app.get("/", (req, res) => res.send("APEX-MD Bot is Running ✅"));
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    startBot();
});

// Anti-crash කොටස (බොට් මැරෙන්න නොදී තියාගන්න)
process.on('uncaughtException', (err) => console.log('Caught exception: ', err));
process.on('unhandledRejection', (reason, promise) => console.log('Unhandled Rejection at:', promise, 'reason:', reason));
