// plugins/vps_files.js
// Browse the VPS folder (config.VPS_FILES_DIR) and send files from it to WhatsApp.
//   .files [folder]      -> list a folder (numbered)
//   .getfile <no|path>   -> send that file/number as a document
// Owner only. Cannot leave VPS_FILES_DIR (path traversal + symlink safe).
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const config = require('../config');
const { cmd } = require('../command');

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // WhatsApp document limit (~2GB)
const PAGE = 40;
const lastList = new Map(); // chat jid -> { dir, items: [absolute paths] }

const ROOT = () => {
    fs.mkdirSync(config.VPS_FILES_DIR, { recursive: true });
    return fs.realpathSync(config.VPS_FILES_DIR);
};

// Resolve a user supplied relative path inside ROOT, or return null if it escapes.
function safeResolve(rel) {
    const root = ROOT();
    const target = path.resolve(root, (rel || '').replace(/^\/+/, ''));
    let real;
    try { real = fs.realpathSync(target); } catch { return { root, real: null }; }
    if (real !== root && !real.startsWith(root + path.sep)) return { root, real: null, escaped: true };
    return { root, real };
}

const fmtSize = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` :
    b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`;

function listDir(dir) {
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(d => !d.name.startsWith('.'))
        .map(d => {
            const full = path.join(dir, d.name);
            let st; try { st = fs.statSync(full); } catch { return null; }
            return { name: d.name, full, isDir: st.isDirectory(), size: st.size };
        })
        .filter(Boolean)
        .sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));
}

cmd({
    pattern: "files",
    alias: ["ls", "vpsfiles"],
    desc: "List files in the VPS folder",
    use: ".files [folder]",
    category: "vps",
    react: "📂",
    filename: __filename
},
async (conn, mek, m, { from, q, isOwner, reply }) => {
    if (!isOwner) return;
    try {
        let rel = (q || '').trim();
        // allow ".files 3" to open folder number 3 from the previous listing
        if (/^\d+$/.test(rel) && lastList.has(from)) {
            const it = lastList.get(from).items[Number(rel) - 1];
            if (it) rel = path.relative(ROOT(), it.full);
        }
        const { root, real, escaped } = safeResolve(rel);
        if (escaped) return reply("🚫 ඒ path එකට අවසර නැහැ.");
        if (!real) return reply("❌ Folder එක හොයාගන්න බැහැ.");
        if (!fs.statSync(real).isDirectory()) return reply("ℹ️ ඒක file එකක්. එවන්න: .getfile " + path.relative(root, real));

        const items = listDir(real);
        lastList.set(from, { dir: real, items });
        const shown = items.slice(0, PAGE);
        const here = path.relative(root, real) || '/';
        let t = `📂 *${here}*  (${items.length} items)\n\n`;
        shown.forEach((it, i) => {
            t += `${i + 1}. ${it.isDir ? '📁' : '📄'} ${it.name}${it.isDir ? '/' : '  — ' + fmtSize(it.size)}\n`;
        });
        if (items.length > PAGE) t += `\n… තවත් ${items.length - PAGE}ක් තියෙනවා (folder එකක් open කරන්න .files <folder>)`;
        if (!items.length) t += "_හිස්_";
        t += `\n\n📥 *.getfile <number>* හෝ *.getfile <path>*\n📁 folder එකක් open කරන්න: *.files <number>*`;
        reply(t);
    } catch (e) {
        console.error('[files]', e);
        reply(`❌ ${e.message}`);
    }
});

cmd({
    pattern: "getfile",
    alias: ["get", "vpsget", "fetchfile"],
    desc: "Send a VPS file to WhatsApp",
    use: ".getfile <number|path>",
    category: "vps",
    react: "📥",
    filename: __filename
},
async (conn, mek, m, { from, q, isOwner, reply }) => {
    if (!isOwner) return;
    try {
        let arg = (q || '').trim();
        if (!arg) return reply("❌ උදා: *.getfile 2*  හෝ  *.getfile logs/app.log*");

        let rel = arg;
        if (/^\d+$/.test(arg)) {
            const last = lastList.get(from);
            const it = last && last.items[Number(arg) - 1];
            if (!it) return reply("❌ ඒ number එක නැහැ. මුලින් *.files* ගහන්න.");
            rel = path.relative(ROOT(), it.full);
        }

        const { root, real, escaped } = safeResolve(rel);
        if (escaped) return reply("🚫 ඒ path එකට අවසර නැහැ.");
        if (!real) return reply("❌ File එක හොයාගන්න බැහැ.");
        const st = fs.statSync(real);
        if (st.isDirectory()) return reply("📁 ඒක folder එකක්. *.files " + path.relative(root, real) + "* පාවිච්චි කරන්න.");
        if (st.size === 0) return reply("❌ File එක හිස්.");
        if (st.size > MAX_BYTES) return reply(`❌ File එක ${fmtSize(st.size)} — WhatsApp වලට 2GB ට වඩා එවන්න බැහැ.`);

        const fileName = path.basename(real);
        await reply(`⏳ *${fileName}* (${fmtSize(st.size)}) එවනවා...`);
        // { url: <local path> } makes Baileys stream the file from disk (no full read into RAM)
        await conn.sendMessage(from, {
            document: { url: real },
            mimetype: mime.lookup(fileName) || 'application/octet-stream',
            fileName,
            caption: `📄 ${fileName}\n📦 ${fmtSize(st.size)}`
        }, { quoted: mek });
    } catch (e) {
        console.error('[getfile]', e);
        reply(`❌ ${e.message}`);
    }
});
