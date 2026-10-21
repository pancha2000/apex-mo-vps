// plugins/downloader.js
// Download anything from the internet onto the VPS, then send it to WhatsApp.
//   .dl <url>        download -> save in <VPS_FILES_DIR>/downloads -> send to chat
//   .dl -n <url>     download only (keep on VPS, don't send)
//   .dl -a <url>     audio only (mp3) for video sites
// Supports: direct links, MEGA file links, and 1000+ sites via yt-dlp (YouTube, Facebook, TikTok...).
// Owner only.
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mime = require('mime-types');
const { execFile } = require('child_process');
const { pipeline } = require('stream/promises');
const config = require('../config');
const { cmd } = require('../command');

const { sendDocument } = require('../lib/sendfile');
const { registerListing } = require('../lib/vpsfiles');
const MAX_BYTES = config.DL_MAX_MB * 1024 * 1024;
const VIDEO_SITES = /(^|\.)(youtube\.com|youtu\.be|facebook\.com|fb\.watch|instagram\.com|tiktok\.com|twitter\.com|x\.com|vimeo\.com|soundcloud\.com|dailymotion\.com|reddit\.com|twitch\.tv|pinterest\.com|spotify\.com)$/i;

const fmtSize = (b) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` :
    b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`;

const cleanName = (n) => (n || 'file').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150) || 'file';

function dlDir() {
    const d = path.join(config.VPS_FILES_DIR, 'downloads');
    fs.mkdirSync(d, { recursive: true });
    return d;
}

function uniquePath(dir, name) {
    let p = path.join(dir, name);
    if (!fs.existsSync(p)) return p;
    const ext = path.extname(name);
    return path.join(dir, `${path.basename(name, ext)}_${Date.now()}${ext}`);
}

// Stream a readable into dir/name via a .part file, aborting if it grows past MAX_BYTES.
async function saveStream(readable, dir, name) {
    const finalPath = uniquePath(dir, cleanName(name));
    const part = finalPath + '.part';
    let size = 0;
    readable.on('data', (c) => {
        size += c.length;
        if (size > MAX_BYTES) readable.destroy(new Error(`File ${fmtSize(MAX_BYTES)} ට වඩා ලොකුයි`));
    });
    try {
        await pipeline(readable, fs.createWriteStream(part));
        fs.renameSync(part, finalPath);
        return finalPath;
    } catch (e) {
        fs.rmSync(part, { force: true });
        throw e;
    }
}

async function downloadDirect(url, dir) {
    const res = await axios({
        url, method: 'get', responseType: 'stream', timeout: 30000, maxRedirects: 8,
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36' },
        validateStatus: (s) => s >= 200 && s < 300,
    });
    const type = String(res.headers['content-type'] || '');
    if (type.includes('text/html')) { res.data.destroy(); const e = new Error('HTML_PAGE'); e.code = 'HTML_PAGE'; throw e; }
    const len = Number(res.headers['content-length'] || 0);
    if (len > MAX_BYTES) { res.data.destroy(); throw new Error(`File එක ${fmtSize(len)} — limit එක ${fmtSize(MAX_BYTES)}`); }

    let name = '';
    const cd = String(res.headers['content-disposition'] || '');
    const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
    if (m) { try { name = decodeURIComponent(m[1]); } catch { name = m[1]; } }
    if (!name) { try { name = decodeURIComponent(path.basename(new URL(res.request?.res?.responseUrl || url).pathname)); } catch {} }
    if (!name || !path.extname(name)) name = (name || 'download') + (mime.extension(type.split(';')[0]) ? '.' + mime.extension(type.split(';')[0]) : '');
    return saveStream(res.data, dir, name);
}

async function downloadMega(url, dir) {
    const { File } = require('megajs');
    const file = File.fromURL(url);
    await file.loadAttributes();
    if (file.size > MAX_BYTES) throw new Error(`File එක ${fmtSize(file.size)} — limit එක ${fmtSize(MAX_BYTES)}`);
    return saveStream(file.download(), dir, file.name || `mega_${Date.now()}`);
}

function downloadYtdlp(url, dir, audioOnly) {
    const args = ['--no-playlist', '--no-warnings', '-q', '--restrict-filenames',
        '--max-filesize', `${Math.floor(MAX_BYTES / 1048576)}M`,
        '-o', path.join(dir, '%(title).120B [%(id)s].%(ext)s'),
        '--no-simulate', '--print', 'after_move:filepath'];
    if (audioOnly) args.push('-x', '--audio-format', 'mp3');
    else args.push('-f', 'bv*[height<=720]+ba/b[height<=720]/b', '--merge-output-format', 'mp4');
    args.push('--', url);
    return new Promise((resolve, reject) => {
        execFile(config.YTDLP_BIN, args, { maxBuffer: 10 * 1024 * 1024, timeout: 30 * 60 * 1000 }, (err, stdout, stderr) => {
            if (err) {
                if (err.code === 'ENOENT') return reject(new Error('yt-dlp install කරලා නැහැ (bash start.sh run කරන්න)'));
                return reject(new Error((stderr || err.message).toString().trim().split('\n').pop()));
            }
            const out = stdout.toString().trim().split('\n').filter(Boolean).pop();
            if (!out || !fs.existsSync(out)) return reject(new Error('yt-dlp: file එක හම්බුණේ නැහැ'));
            resolve(out);
        });
    });
}

async function fetchToVps(url, dir, audioOnly) {
    const host = new URL(url).hostname;
    if (/(^|\.)mega\.(nz|io)$/i.test(host)) return downloadMega(url, dir);
    if (VIDEO_SITES.test(host)) return downloadYtdlp(url, dir, audioOnly);
    try {
        return await downloadDirect(url, dir);
    } catch (e) {
        if (e.code === 'HTML_PAGE') return downloadYtdlp(url, dir, audioOnly); // page with embedded video?
        throw e;
    }
}

async function sendToChat(conn, from, mek, file, reply, compress) {
    const size = fs.statSync(file).size;
    const name = path.basename(file);
    const type = mime.lookup(name) || 'application/octet-stream';
    const caption = `📄 ${name}\n📦 ${fmtSize(size)}`;
    const src = { url: file }; // streamed from disk
    if (compress) return sendDocument(conn, from, mek, file, reply, { compress: true });
    if (type.startsWith('image/') && size < 10 * 1048576) return conn.sendMessage(from, { image: src, caption }, { quoted: mek });
    if (type.startsWith('video/') && size < 60 * 1048576) return conn.sendMessage(from, { video: src, mimetype: type, caption }, { quoted: mek });
    if (type.startsWith('audio/') && size < 60 * 1048576) return conn.sendMessage(from, { audio: src, mimetype: type }, { quoted: mek });
    return sendDocument(conn, from, mek, file, reply);
}

cmd({
    pattern: "dl",
    alias: ["download", "dlfile"],
    desc: "Download a link to the VPS and send it to WhatsApp",
    use: "<url>  (-n save only, -a mp3, -z zip)",
    category: "vps",
    react: "⬇️",
    filename: __filename
},
async (conn, mek, m, { from, q, isOwner, reply }) => {
    if (!isOwner) return;
    let file;
    try {
        const parts = (q || '').trim().split(/\s+/).filter(Boolean);
        const flags = parts.filter(p => /^-[naz]$/i.test(p)).map(p => p.toLowerCase());
        const url = parts.find(p => /^https?:\/\//i.test(p));
        if (!url) return reply("❌ Link එකක් දෙන්න.\nඋදා: *.dl https://example.com/file.zip*\n*.dl -a <youtube link>* (mp3)\n*.dl -n <link>* (VPS එකට විතරක්)\n*.dl -z <link>* (zip කරලා එවන්න)");

        await reply("⏳ VPS එකට download කරනවා...");
        file = await fetchToVps(url, dlDir(), flags.includes('-a'));
        const size = fs.statSync(file).size;
        const num = registerListing(from, file); // so the file can be fetched by number

        if (flags.includes('-n')) return reply(`✅ VPS එකට save වුණා\n📄 ${path.basename(file)}\n📦 ${fmtSize(size)}\n\n📥 WhatsApp එකට ගන්න: *.getfile ${num}*\n🗜️ Compress කරලා: *.getfile -z ${num}*`);

        await reply(`📤 WhatsApp එකට එවනවා... (${fmtSize(size)})`);
        await sendToChat(conn, from, mek, file, reply, flags.includes('-z'));
    } catch (e) {
        console.error('[dl]', e);
        reply(`❌ ${e.message}`);
    }
});
