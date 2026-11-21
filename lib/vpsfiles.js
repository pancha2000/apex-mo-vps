// lib/vpsfiles.js - shared helpers for plugins/vps_files.js and plugins/downloader.js
const fs = require('fs');
const path = require('path');

// chat jid -> { dir, items: [{ name, full, isDir, size }] }  (used for ".getfile <number>")
const lastList = new Map();

// List a directory: folders first, then files, each sorted by name.
function listDir(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true }).map((d) => {
        const full = path.join(dir, d.name);
        let isDir = d.isDirectory(), size = 0;
        try { const st = fs.statSync(full); isDir = st.isDirectory(); size = isDir ? 0 : st.size; } catch { /* broken symlink */ }
        return { name: d.name, full, isDir, size };
    });
    return items.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
}

// Put a single file into the chat's "last list" and return its number (for .getfile <number>).
function registerListing(from, file) {
    const dir = path.dirname(file);
    const items = listDir(dir);
    lastList.set(from, { dir, items });
    const idx = items.findIndex((it) => it.full === file);
    return idx === -1 ? 1 : idx + 1;
}

module.exports = { lastList, listDir, registerListing };
