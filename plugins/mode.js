// plugins/mode.js (Modified to display only, no update)
const { AddCommand } = require('../command');
const { getBotSettings } = require('../lib/mongodb'); // Setting කියවීමට පමණක් getBotSettings අවශ්‍යයි

AddCommand({
    pattern: "mode",
    alias: ["getmode"], // "getmode" ලෙස alias එක වෙනස් කිරීම අර්ථවත් වේ
    desc: "Displays the current bot mode. Use .update MODE:<mode> to change.", // විස්තරය වෙනස් කරන්න
    usage: ".mode",
    fromMe: true, // Only owner can check
    react: "ℹ️",
    category: "info",
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    const botSettings = getBotSettings(); // වත්මන් settings ලබා ගන්න
    reply(`වර්තමාන බොට් ආකාරය: *${botSettings.MODE.toUpperCase()}*\n\nMode වෙනස් කිරීමට: .update MODE:<public|private|inbox|groups>`);
});