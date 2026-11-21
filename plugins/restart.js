const config = require('../config')
const {cmd , commands} = require('../command')
const {sleep} = require('../lib/functions')

cmd({
    pattern: "restart",
    desc: "restart the bot",
    category: "owner",
    filename: __filename
},
async(conn, mek, m,{from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply}) => {
try{
  if(!isOwner) return
const {exec} = require("child_process")
reply("restarting APEX-MD...")
await sleep(1500)
exec("pm2 restart all", (err) => { if (err) process.exit(0); }) // no pm2 (e.g. Hugging Face) -> exit, platform restarts us
}catch(e){
console.log(e)
reply(`${e}`)
}
})
