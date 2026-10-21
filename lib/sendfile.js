// lib/sendfile.js - send a file as a WhatsApp document.
//  * opts.compress -> zip first (only used if it really makes the file smaller)
//  * files over WHOLE_MAX are split in parts
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

const zipFile = (file, zipPath) => new Promise((resolve, reject) => {
    // -j: no folder paths inside, -9: best compression. Run from the file's dir; no shell involved.
    execFile('zip', ['-j', '-9', '-q', zipPath, file], { timeout: 60 * 60 * 1000 },
        (err) => err ? reject(new Error(err.code === 'ENOENT' ? 'zip install කරලා නැහැ (sudo apt install zip)' : 'zip failed: ' + err.message)) : resolve());
});

// Sends `file`. Returns number of parts sent (1 = whole file).
async function sendDocument(conn, from, mek, file, reply = async () => {}, opts = {}) {
    const tmpDir = path.join(config.VPS_FILES_DIR, '.parts', String(Date.now()));
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
        let sendPath = file;
        let size = fs.statSync(file).size;

        if (opts.compress) {
            await reply(`🗜️ Compress කරනවා... (${fmtSize(size)})`);
            const zipPath = path.join(tmpDir, path.basename(file) + '.zip');
            await zipFile(file, zipPath);
            const zsize = fs.statSync(zipPath).size;
            if (zsize < size * 0.95) {
                await reply(`✅ ${fmtSize(size)} → ${fmtSize(zsize)} (${Math.round((1 - zsize / size) * 100)}% අඩුයි)`);
                sendPath = zipPath; size = zsize;
            } else {
                await reply(`ℹ️ මේ file එක දැනටමත් compress වෙලා (video/zip/apk/jpg වගේ), size එක අඩු වෙන්නේ නැහැ. Original එකම එවනවා.`);
                fs.rmSync(zipPath, { force: true });
            }
        }

        const name = path.basename(sendPath);
        const type = mime.lookup(name) || 'application/octet-stream';

        if (size <= WHOLE_MAX) {
            await conn.sendMessage(from, {
                document: { url: sendPath }, mimetype: type, fileName: name,
                caption: `📄 ${name}\n📦 ${fmtSize(size)}`
            }, { quoted: mek });
            return 1;
        }

        await reply(`✂️ File එක ${fmtSize(size)} — WhatsApp limit එකට වඩා ලොකුයි. ${fmtSize(PART_SIZE)} කොටස් වලට කඩනවා...`);
        const partsDir = path.join(tmpDir, 'parts');
        fs.mkdirSync(partsDir);
        await splitFile(sendPath, path.join(partsDir, name + '.'));
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
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

module.exports = { sendDocument, fmtSize };
