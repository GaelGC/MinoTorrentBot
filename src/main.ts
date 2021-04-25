import discord = require('discord.js');
require('discord-reply');
const client = new discord.Client();

client.on('ready', () => {
    if (client.user === null) {
        console.error("Unable to log to Discord.");
        throw new Error();
    }
    console.log(`Logged in as ${client.user.tag}. ID ${client.user.id}`);
});

function split_line(line : string) : string[] | undefined {
    var res : string[] | undefined = new Array();

    res = line.replace(/\s+/g, ' ').trim().split(' ');

    if (res.length === 1 && res[0] === "") {
        res = undefined;
    }

    return res;
}

function split_message(message : string) : string[][] | undefined {
    var res : string[][] = new Array();
    var lines = message.split('\n');

    lines.forEach(line => {
        const splitted = split_line(line);
        if (splitted !== undefined) {
            res.push(splitted);
        }
    })

    return res.length === 0 ? undefined : res;
}

function getRole(guild : discord.Guild | null) : string {
    if (guild === null) {
        return "error: no guild";
    }
    const myRole = guild.roles.cache.find(role => role.name === "Minobot");
    if (myRole === undefined) {
        return "Unable to find role Minobot";
    }
    return myRole.id;
}

function reply_to_message(message : discord.Message, response : string) {
    const fake_message : any = message;
    fake_message.lineReply("Invalid empty message.");
}

client.on('message', message => {
    if (client.user === null) {
        console.error("Unable to log to Discord.");
        throw new Error();
    }

    const role_id = getRole(message.guild);
    const tag : RegExp = new RegExp(`<@(!${client.user.id}|&${role_id})>`);
    let text = message.content;
    console.log(text);
	if (!text.match(tag)) {
        return;
    }
    text = text.replace(tag, "");

    const splitted = split_message(text);
    console.log(splitted)
    if (splitted === undefined) {
        reply_to_message(message, "Invalid empty message.");
        console.error("Received an empty message");
        return;
    }
});

client.login("INSERT YOUR TOKEN HERE");