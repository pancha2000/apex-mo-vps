// lib/sendfile.js - send a file as a WhatsApp document; files over WHOLE_MAX are split in parts.
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { execFile } = require('child_process');
const config = require('../config');

const MB = 1024 * 1024;
const WHOLE_MAX = Number(config.WHOLE_MAX_MB || 1900) * MB;  // bigger than this -> split
const PART_SIZE = Number(config.PART_MB || 1500) * MB;       // size of each part

const fmtSize = (b) => b < MB ? `${(b / 1024).toFixed(1)} KB` :
    b < 1024 * MB ? `${(b / MB).toFixed(1)} MB` : `${(b / (1024 * MB)).toFixed(2)} GB`;

const splitFile = (file, outPrefix) => new Promise((resolve, reject) => {
    execFile('split', ['-b', String(PART_SIZE), '-d', '-a', '3', '--numeric-suffixes=1', file, outPrefix],
        (err) => err ? reject(new Error('split failed: ' + err.message)) : resolve());
});

// Sends `file`. Returns number of parts sent (1 = whole file).
async function sendDocument(conn, from, mek, file, reply = async () => {}) {
    const size = fs.statSync(file).size;
    const name = path.basename(file);
    const type = mime.lookup(name) || 'application/octet-stream';

    if (size <= WHOLE_MAX) {
        await conn.sendMessage(from, {
            document: { url: file }, mimetype: type, fileName: name,
            caption: `📄 ${name}\n📦 ${fmtSize(size)}`
        }, { quoted: mek });
        return 1;
    }

    const partsDir = path.join(config.VPS_FILES_DIR, '.parts', String(Date.now()));
    fs.mkdirSync(partsDir, { recursive: true });
    try {
        await reply(`✂️ File එක ${fmtSize(size)} — WhatsApp limit එකට වඩා ලොකුයි. ${fmtSize(PART_SIZE)} කොටස් වලට කඩනවා...`);
        await splitFile(file, path.join(partsDir, name + '.'));
        const parts = fs.readdirSync(partsDir).sort();
        await reply(`📤 කොටස් ${parts.length}ක් එවනවා. එකිනෙක එනකම් ඉන්න...`);
        for (let i = 0; i < parts.length; i++) {
            const p = path.join(partsDir, parts[i]);
            try {
                await conn.sendMessage(from, {
                    document: { url: p }, mimetype: 'application/octet-stream', fileName: parts[i],
                    caption: `📦 Part ${i + 1}/${parts.length}\n📄 ${name}\n${fmtSize(fs.statSync(p).size)}`
                }, { quoted: mek });
            } catch (e) {
                throw new Error(`Part ${i + 1}/${parts.length} යවන්න බැරි වුණා: ${e.message}`);
            }
        }
        await reply(`✅ කොටස් ${parts.length}ම යැව්වා.\n\n🔧 *එකතු කරන විදිය*\n• Windows: 7-Zip වලින් *${name}.001* open කරලා Extract කරන්න\n• Linux/Termux: \`cat ${name}.* > ${name}\``);
        return parts.length;
    } finally {
        fs.rmSync(partsDir, { recursive: true, force: true });
    }
}

module.exports = { sendDocument, fmtSize };
