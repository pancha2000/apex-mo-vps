const mongoose = require('mongoose');
const config = require('../config');
const EnvVar = require('./mongodbenv'); // ඔයාගේ ෆයිල් නම මෙතනට දැම්මා

let _botSettings = {
    PREFIX: ".",
    MODE: "public",
    ALIVE_IMG: "https://i.postimg.cc/BbjVss8k/file-00000000d88461f7be4a5cc1864c4be5-1.png",
    ALIVE_MSG: "Hello , I am alive now!!",
};

const defaultEnvVariables = [
    { key: 'ALIVE_IMG', value: 'https://i.postimg.cc/BbjVss8k/file-00000000d88461f7be4a5cc1864c4be5-1.png' },
    { key: 'ALIVE_MSG', value: 'Hello , I am alive now!!' },
    { key: 'PREFIX', value: '.' },
    { key: 'MODE', value: 'public' },
];

const connectDB = async () => {
    if (!config.MONGODB) {
        console.error('MongoDB URL is not defined in config.');
        process.exit(1);
    }
    try {
        // Warning අයින් කිරීමට 'useNewUrlParser' සහ 'useUnifiedTopology' ඉවත් කරන ලදී
        await mongoose.connect(config.MONGODB, {
            dbName: 'apex_md_db', // Database නම
        });
        console.log('🛜 MongoDB Connected ✅');

        // Default දත්ත තිබේදැයි පරීක්ෂා කිරීම
        for (const envVar of defaultEnvVariables) {
            try {
                const existingVar = await EnvVar.findOne({ key: envVar.key });
                if (!existingVar) {
                    await EnvVar.create(envVar);
                }
            } catch (dbOpError) {
                console.error(`Error processing default env var ${envVar.key}:`, dbOpError.message);
            }
        }
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
    }
};

const readEnv = async () => {
    try {
        if (mongoose.connection.readyState !== 1) {
            await connectDB();
        }
        const envVars = await EnvVar.find({});
        if (envVars && envVars.length > 0) {
            envVars.forEach(doc => {
                _botSettings[doc.key] = doc.value;
            });
        }
    } catch (error) {
        console.error("Error reading environment from DB:", error.message);
    }
};

const updateEnv = async (key, value) => {
    try {
        const updatedDoc = await EnvVar.findOneAndUpdate(
            { key: key },
            { value: value },
            { upsert: true, new: true }
        );
        _botSettings[key] = updatedDoc.value;
        return updatedDoc;
    } catch (error) {
        console.error(`Error updating ${key} in DB:`, error.message);
        throw error;
    }
};

const getBotSettings = () => {
    return { ..._botSettings };
};

module.exports = {
    connectDB,
    readEnv,
    updateEnv,
    getBotSettings,
    defaultEnvVariables,
};
