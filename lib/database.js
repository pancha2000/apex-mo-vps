// lib/database.js - thin wrapper kept for the plugins that import it (alive, menu).
const { readEnv, updateEnv } = require('./mongodb');

module.exports = {
    readEnv,
    updateEnv: async (key, value) => {
        try { await updateEnv(key, value); return true; }
        catch (e) { console.error(`Error updating ${key}:`, e.message); return false; }
    },
};
