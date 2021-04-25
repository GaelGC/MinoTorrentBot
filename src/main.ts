import discord = require('discord.js');
require('discord-reply');
import webTorrent = require('webtorrent')
import CryptoJS = require('crypto-js');

const client = new discord.Client();
const webtorrent_client = new webTorrent();

const local_out_dir = "/srv/http/";
const remote_out_dir = "http://server_address/";

client.on('ready', () => {
    if (client.user === null) {
        console.error("Unable to log to Discord.");
        throw new Error();
    }
    console.log(`Logged in as ${client.user.tag}. ID ${client.user.id}`);
});

function split_line(line: string): string[] | undefined {
    var res: string[] | undefined = new Array();

    res = line.replace(/\s+/g, ' ').trim().split(' ');

    if (res.length === 1 && res[0] === "") {
        res = undefined;
    }

    return res;
}

function split_message(message: string): string[][] | undefined {
    var res: string[][] = new Array();
    var lines = message.split('\n');

    lines.forEach(line => {
        const splitted = split_line(line);
        if (splitted !== undefined) {
            res.push(splitted);
        }
    })

    return res.length === 0 ? undefined : res;
}

function getRole(guild: discord.Guild | null): string {
    if (guild === null) {
        return "error: no guild";
    }
    const myRole = guild.roles.cache.find(role => role.name === "Minobot");
    if (myRole === undefined) {
        return "Unable to find role Minobot";
    }
    return myRole.id;
}

function reply_to_message(message: discord.Message, response: string) {
    const fake_message: any = message;
    fake_message.lineReply(response);
}

function handle_line(message: discord.Message, line: string[]) {
    var url = line[0];

    console.log(`Downloading ${url}`);

    const hash = CryptoJS.SHA256(url);
    const torrent = webtorrent_client.add(url,
        { path: `${local_out_dir}/${hash}` });
    torrent.on('done', function () {
        let file_str : string[] = new Array();
        torrent.files.forEach((file) => {
            file_str.push(`${remote_out_dir}/${hash}/${file.path}`);
        });
        reply_to_message(message, file_str.join('\n').replace(/ /g, "%20"));
        torrent.destroy();
    });

    var emoji = client.emojis.cache.find(emoji => emoji.name === "torrent_ack");

    let promise: Promise<void | discord.MessageReaction> = Promise.resolve();

    promise = promise.then(() => {
        if (emoji !== undefined) {
            message.react(emoji);
        }
    });
    let previous_progress = 101;
    torrent.on('download', function (bytes) {
        let cur_progress = ((100 * (torrent.progress + 0.001) / 10) | 0) * 10;
        if (cur_progress != previous_progress && promise !== undefined) {
            const new_emoji_name = "torrent_" + cur_progress;
            const old_emoji_name = "torrent_" + previous_progress;
            promise = promise.then(async () => {
                const old_emoji = message.reactions.cache.find(r => r.emoji.name == old_emoji_name);
                if (old_emoji) {
                    await old_emoji.users.remove(client.user?.id);
                }
                var emoji = client.emojis.cache.find(emoji => emoji.name === new_emoji_name);
                if (emoji !== undefined) {
                    var real_emoji = emoji;
                    await message.react(real_emoji);
                }
            });
            previous_progress = cur_progress;
        }
    });
}

client.on('message', message => {
    if (client.user === null) {
        console.error("Unable to log to Discord.");
        throw new Error();
    }

    const role_id = getRole(message.guild);
    const tag: RegExp = new RegExp(`<@(!${client.user.id}|&${role_id})>`);
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

    splitted.forEach(line => {
        handle_line(message, line);
    });
});

client.login("INSERT YOUR TOKEN HERE");