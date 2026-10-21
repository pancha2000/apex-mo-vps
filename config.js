const fs = require('fs');
if (fs.existsSync('config.env')) {
    require('dotenv').config({ path: './config.env' });
}

// convertToBool function was not used, so it's removed.
// If you need it later, you can re-add it.

module.exports = {
  //===================Bot info===============================
    SESSION_ID: process.env.SESSION_ID || "ii4HlLpT#gm4GoXqNj5gLk34STOGuzjgjC-WcFNYeDhrWo8Na1xc",
    MONGODB: process.env.MONGODB || "mongodb+srv://realpancha:2006.Shehan@cluster0.jh6kzmp.mongodb.net/",
 
    
// ==================Your info=================================

  OWNER_NAME: process.env.OWNER_NAME || "Shehan Vimukthi",
  PUBLIC_NAME: process.env.PUBLIC_NAME || "Real Pancha",
  NICKNAME: process.env.NICKNAME || "Pancha",
  AGE: process.env.AGE || "19",
  OWNER_CONTACT: process.env.OWNER_CONTACT || "wa.me/+94701391585",
  

};


//mongodb+srv://pancha:2006.Shehan@cluster0.hyugfei.mongodb.net/
