// plugins/settings.js (මෙය ඔබගේ කලින් update_env.js හි සංශෝධිත කොටස සහ .get විධානයද අඩංගු වේ)
const { updateEnv, readEnv, getBotSettings } = require('../lib/mongodb');
const { cmd } = require('../command');

cmd({
    pattern: "update",
    alias: ["set"],
    desc: "Update a bot setting in the database (e.g., .update ALIVE_MSG:hello). All settings.",
    usage: ".update <KEY> <VALUE>",
    fromMe: true,
    react: "🔄",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { q, reply, isOwner }) => {
    if (!isOwner) return reply("මෙම විධානය භාවිතා කළ හැක්කේ බොට් හිමිකරුට පමණි.");

    if (!q) {
        return reply("🙇‍♂️ *Please provide the environment variable and its new value.* \n\nExample: `.update ALIVE_MSG hello ` or `.update MODE public`");
    }

    const delimiterIndex = q.indexOf(':') !== -1 ? q.indexOf(':') : q.indexOf(',');
    if (delimiterIndex === -1) {
        return reply("🫠 *Invalid format. Please use the format:* `.update KEY VALUE`");
    }

    const keyToUpdate = q.substring(0, delimiterIndex).trim().toUpperCase();
    const valueToUpdate = q.substring(delimiterIndex + 1).trim();

    if (!keyToUpdate) {
        return reply("🫠 *Invalid format. Key cannot be empty. Use:* `.update KEY VALUE`");
    }

    const validModes = ['public', 'private', 'groups', 'inbox'];

    if (keyToUpdate === 'MODE' && !validModes.includes(valueToUpdate.toLowerCase())) {
        return reply(`😒 *Invalid mode. Valid modes are: ${validModes.join(', ')}*`);
    }
    if (keyToUpdate === 'ALIVE_IMG') {
        try {
            new URL(valueToUpdate);
            if (!valueToUpdate.startsWith('http://') && !valueToUpdate.startsWith('https://')) {
                return reply("😓 *Invalid URL format for ALIVE_IMG. Please provide a valid HTTP/HTTPS URL.*");
            }
        } catch (e) {
            return reply("😓 *Invalid URL format for ALIVE_IMG. Please provide a valid URL.*");
        }
    }
    
    if (keyToUpdate === 'PREFIX' && (valueToUpdate.length > 1 || /\s/.test(valueToUpdate))) {
        return reply("😓 *Invalid PREFIX. It should be a single character without spaces.*");
    }

    try {
        const updatedDoc = await updateEnv(keyToUpdate, valueToUpdate);

        if (updatedDoc) {
            reply(`✅ *Environment variable updated.*\n\n🗃️ *${keyToUpdate}* ➠ ${valueToUpdate}`);
            await readEnv(); // Update internal cache
        } else {
            reply(`🙇‍♂️ *Failed to update the environment variable ${keyToUpdate}. Please check logs.*`);
        }
        
    } catch (err) {
        console.error('Error in update command:', err);
        reply(`🙇‍♂️ *An unexpected error occurred: ${err.message}. Please try again.*`);
    }
});

// .get (View Settings) Command
cmd({
    pattern: "get",
    alias: ["view"],
    desc: "View current bot settings (e.g., .get MODE)",
    usage: ".get <KEY>",
    fromMe: true,
    react: "🔍",
    category: "owner",
    filename: __filename
}, async (conn, mek, m, { args, reply, isOwner }) => {
    if (!isOwner) return reply("මෙම විධානය භාවිතා කළ හැක්කේ බොට් හිමිකරුට පමණි.");

    const key = args[0] ? args[0].trim().toUpperCase() : '';
    if (!key) {
        // සියලුම existing keys පෙන්වීමට
        const allSettings = getBotSettings();
        const keys = Object.keys(allSettings).sort().join(', ');
        return reply(`ඔබට බැලීමට අවශ්‍ය Setting එකේ KEY එක ලබා දෙන්න. උදා: .get MODE\n\nපවතින Keys: ${keys}`);
    }

    const botSettings = getBotSettings();
    const value = botSettings[key];

    if (value === undefined) {
        reply(`Setting: *${key}* හමු නොවීය.`);
    } else {
        reply(`Setting: *${key}* = *${value}*`);
    }
});