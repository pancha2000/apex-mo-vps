// plugins/vps_files.js
// Browse the VPS folder (config.VPS_FILES_DIR) and send files from it to WhatsApp.
//   .files [folder]      -> list a folder (numbered)
//   .getfile <no|path>   -> send that file/number as a document
// Owner only. Cannot leave VPS_FILES_DIR (path traversal + symlink safe).
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const config = require('../config');
const { sendDocument } = require('../lib/sendfile');
const { lastList, listDir } = require('../lib/vpsfiles');
const { cmd } = require('../command');

const PAGE = 40;

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

cmd({
    pattern: "files",
    alias: ["ls", "vpsfiles"],
    desc: "List files in the VPS folder",
    use: "[folder]",
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
    use: "<number|path>  (-z zip)",
    category: "vps",
    react: "📥",
    filename: __filename
},
async (conn, mek, m, { from, q, isOwner, reply }) => {
    if (!isOwner) return;
    try {
        let arg = (q || '').trim();
        const compress = /(^|\s)-z(\s|$)/i.test(arg);
        arg = arg.replace(/(^|\s)-z(?=\s|$)/ig, ' ').trim();
        if (!arg) return reply("❌ උදා: *.getfile 2*  හෝ  *.getfile logs/app.log*\nCompress කරලා ගන්න: *.getfile -z 2*");

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

        const fileName = path.basename(real);
        await reply(`⏳ *${fileName}* (${fmtSize(st.size)}) එවනවා...`);
        await sendDocument(conn, from, mek, real, reply, { compress }); // splits automatically if too big for WhatsApp
    } catch (e) {
        console.error('[getfile]', e);
        reply(`❌ ${e.message}`);
    }
});

cmd({
    pattern: "delfile",
    alias: ["rmfile"],
    desc: "Delete a file from the VPS folder",
    use: "<number|path>",
    category: "vps",
    react: "🗑️",
    filename: __filename
},
async (conn, mek, m, { from, q, isOwner, reply }) => {
    if (!isOwner) return;
    try {
        const arg = (q || '').trim();
        if (!arg) return reply("❌ උදා: *.delfile 3*  හෝ  *.delfile downloads/movie.mp4*");
        let rel = arg;
        if (/^\d+$/.test(arg)) {
            const it = lastList.get(from)?.items[Number(arg) - 1];
            if (!it) return reply("❌ ඒ number එක නැහැ. මුලින් *.files* ගහන්න.");
            rel = path.relative(ROOT(), it.full);
        }
        const { root, real, escaped } = safeResolve(rel);
        if (escaped || (real && real === root)) return reply("🚫 ඒ path එකට අවසර නැහැ.");
        if (!real) return reply("❌ File එක හොයාගන්න බැහැ.");
        if (fs.statSync(real).isDirectory()) return reply("📁 Folder delete කරන්න බැහැ. File එකක් දෙන්න.");
        fs.unlinkSync(real);
        lastList.delete(from);
        reply(`🗑️ Delete වුණා: ${path.relative(root, real)}`);
    } catch (e) {
        console.error('[delfile]', e);
        reply(`❌ ${e.message}`);
    }
});
