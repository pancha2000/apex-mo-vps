const fs = require('fs');
const path = require('path');
if (fs.existsSync(path.join(__dirname, 'config.env'))) {
    require('dotenv').config({ path: path.join(__dirname, 'config.env') });
}

module.exports = {
    // ===== Bot =====
    SESSION_ID: process.env.SESSION_ID || "",      // ID from the Web Pair site (MEGA link part)
    OWNER_NUMBER: process.env.OWNER_NUMBER || "94701391585",

    // ===== Owner info (used by menu/alive) =====
    OWNER_NAME: process.env.OWNER_NAME || "Shehan Vimukthi",
    PUBLIC_NAME: process.env.PUBLIC_NAME || "Real Pancha",
    NICKNAME: process.env.NICKNAME || "Pancha",
    OWNER_CONTACT: process.env.OWNER_CONTACT || "wa.me/+94701391585",

    // ===== VPS file sender =====
    // Folder on the VPS whose files can be fetched with .files / .getfile
    // Downloader (.dl): max size in MB and yt-dlp binary name
    DL_MAX_MB: Number(process.env.DL_MAX_MB || 6000),   // max download size (disk!)
    WHOLE_MAX_MB: Number(process.env.WHOLE_MAX_MB || 1900), // bigger than this is split
    PART_MB: Number(process.env.PART_MB || 1500),           // size of each split part
    YTDLP_BIN: process.env.YTDLP_BIN || 'yt-dlp',
    VPS_FILES_DIR: process.env.VPS_FILES_DIR || path.join(__dirname, 'files'),
};
