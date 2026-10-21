// lib/mongodb.js
// Settings database stored on the VPS itself: data/settings.json (no MongoDB needed).
// Same API as before (connectDB / readEnv / updateEnv / getBotSettings) so index.js is unchanged.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'settings.json');

const defaultEnvVariables = [
    { key: 'ALIVE_IMG', value: 'https://i.postimg.cc/BbjVss8k/file-00000000d88461f7be4a5cc1864c4be5-1.png' },
    { key: 'ALIVE_MSG', value: 'Hello , I am alive now!!' },
    { key: 'PREFIX', value: '.' },
    { key: 'MODE', value: 'public' },
];

let _botSettings = {};
for (const d of defaultEnvVariables) _botSettings[d.key] = d.value;

function load() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            _botSettings = { ..._botSettings, ...saved };
        }
    } catch (e) {
        console.error('settings.json read error (using defaults):', e.message);
    }
}

function save() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_botSettings, null, 2));
    fs.renameSync(tmp, DB_FILE); // atomic: never leaves a half-written file
}

const connectDB = async () => {
    load();
    save(); // creates data/settings.json with defaults on first run
    console.log('🗃️ Local database ready:', DB_FILE);
};

const readEnv = async () => {
    load();
    return { ..._botSettings };
};

const updateEnv = async (key, value) => {
    _botSettings[key] = String(value);
    save();
    return { key, value: _botSettings[key] };
};

const getBotSettings = () => ({ ..._botSettings });

module.exports = { connectDB, readEnv, updateEnv, getBotSettings, defaultEnvVariables };
