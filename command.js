var commands = [];

function cmd(info, func) {
var data = { ...info }; // Create a new object to avoid modifying the original info object directly if passed around
data.function = func;
if (data.dontAddCommandList === undefined) data.dontAddCommandList = false;
if (!info.desc) info.desc = '';
if (data.fromMe === undefined) data.fromMe = false;
if (!info.category) data.category = 'misc';
if (!info.filename) data.filename = "Not Provided"; // Corrected: Use info.filename for consistency

// Ensure 'pattern' or 'cmdname' exists if that's the primary identifier
if (!data.pattern && data.cmdname) { // If pattern is not set but cmdname is, use cmdname as pattern
    data.pattern = data.cmdname;
}
// It's good practice to ensure every command has a primary identifier like 'pattern'
if (!data.pattern) {
    console.warn(`Command from file "${data.filename}" is missing a 'pattern' or 'cmdname'.`);
    // Optionally, skip adding this command or assign a default/placeholder pattern
    // For now, we'll add it, but it might not be triggerable by pattern.
}

commands.push(data);
return data;


}

module.exports = {
cmd,
AddCommand: cmd,
Function: cmd,
Module: cmd,
commands,
};
