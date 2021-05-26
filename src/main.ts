import discord = require('discord.js');
require('discord-reply');
import webTorrent = require('webtorrent')
import CryptoJS = require('crypto-js');

const client = new discord.Client();
const webtorrent_client = new webTorrent();

const local_out_dir = "/srv/http/";
const remote_out_dir = "http://server_address/";

var emojis: discord.Emoji[] = new Array();

class TorrentState {
    constructor(embed: discord.MessageEmbed, hash: string, url: string,
        message: discord.Message, embed_message: Promise<discord.Message>) {
        this.embed = embed;
        this.url = url;
        this.hash = hash;
        this.message = message;
        this.embed_message = embed_message;
        this.last_update = Date.now()
    }
    embed: discord.MessageEmbed;
    url: string;
    hash: string;
    message: discord.Message;
    embed_message: Promise<discord.Message>;
    last_update: number;
};

var torrent_map: Map<webTorrent.Torrent, TorrentState> = new Map();

function state_str(msg: discord.MessageEmbed, percent: number) {
    const oldIdx = msg.fields.findIndex((elem) => elem.name === 'state');
    if (oldIdx !== -1) {
        msg.fields.splice(oldIdx, 1);
    }

    percent = (percent + 0.001) | 0;
    var str: string = "";
    const tens = (percent / 10) | 0;
    const units = (percent % 10) | 0;
    for (var iter = 0; iter < 10; iter++) {
        if (tens > iter) {
            str += emojis[10].toString();
        } else if (iter == tens) {
            str += emojis[units].toString();
        } else {
            str += emojis[0].toString();
        }
    }
    msg.addField("state", `${str} ${percent}%`);
    return msg;
}

client.on('ready', () => {
    if (client.user === null) {
        console.error("Unable to log to Discord.");
        throw new Error();
    }
    console.log(`Logged in as ${client.user.tag}. ID ${client.user.id}`);
    [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach((idx) => {
        const emoji_name = "torrent_" + idx;
        const emoji = client.emojis.cache.find(emoji => emoji.name === emoji_name);
        if (emoji === undefined) {
            throw ("Unknown emoji " + emoji_name);
        }
        emojis.push(emoji);
    });
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

webtorrent_client.on('torrent', (torrent) => {
    var embed = torrent_map.get(torrent);
    if (embed === undefined) {
        return;
    }
    embed.last_update = Date.now();
    embed.embed = state_str(embed.embed, 0).setTitle(torrent.name);
    embed.embed_message = embed.embed_message.then((m) => {
        var e = embed?.embed;
        if (embed === undefined || e === undefined) {
            return m;
        }
        embed.embed_message = m.edit(e);;
        return embed.embed_message;
    });
});

function handle_line(message: discord.Message, line: string[]) {
    var url = line[0];

    console.log(`Downloading ${url}`);

    const hash = CryptoJS.SHA256(url);
    const torrent = webtorrent_client.add(url,
        { path: `${local_out_dir}/${hash}` });

    var embed = new discord.MessageEmbed()
        .setAuthor("MinoTorrentBot")
        .setDescription("Temporary post")
        .setTitle(url)
        .addField('url', url);
    torrent_map.set(torrent, new TorrentState(embed, hash, url, message, message.channel.send(embed)));

    torrent.on('done', function () {
        var embed = torrent_map.get(torrent);
        if (embed === undefined) {
            return;
        }

        const hash = embed.hash;
        var description = "";
        torrent.files.forEach((file) => {
            var path = file.path;
            path = path.replace(/ /g, "%20");
            path = path.replace(/\(/g, "%28");
            path = path.replace(/\)/g, "%29");
            description += `[${file.name}](${remote_out_dir}/${hash}/${path})` + '\n';
            console.log(description);
        });
        description += `<@${embed.message.author.id}>`;
        embed.embed = state_str(embed.embed, 100).setDescription(description);
        embed.embed_message = embed.embed_message.then((m) => {
            var e = embed?.embed;
            if (embed === undefined || e === undefined) {
                return m;
            }
            embed.embed_message = m.edit(e);;
            return embed.embed_message;
        });
        torrent_map.delete(torrent);
        torrent.destroy();
        embed.embed_message.then((m) => {
            if (!embed) {
                return;
            }
            console.log(m.toString());
            reply_to_message(embed.message, `Download for ${embed.url} finished. See ${m.url} for details`);
        });
    });

    var emoji = client.emojis.cache.find(emoji => emoji.name === "torrent_ack");

    if (emoji !== undefined) {
        message.react(emoji);
    }

    let previous_progress = 101;
    torrent.on('download', function (bytes) {
        let cur_progress = (100 * (torrent.progress + 0.001)) | 0;
        const now = Date.now();
        const embed = torrent_map.get(torrent);
        if (!embed) {
            return;
        }
        if (cur_progress != previous_progress && (now - embed.last_update > 5000)) {
            embed.last_update = Date.now();
            embed.embed_message = embed.embed_message.then((m) => {
                embed.embed = state_str(embed.embed, cur_progress);
                var e = embed?.embed;
                if (embed === undefined || e === undefined) {
                    return m;
                }
                embed.embed_message = m.edit(e);;
                return embed.embed_message;
            });
        }
    });
}

client.on('message', message => {
    if (client.user === null) {
        console.error("Unable to log to Discord.");
        throw new Error();
    }

    const role_id = getRole(message.guild);
    const tag: RegExp = new RegExp(`<@(!?${client.user.id}|&${role_id})>`);
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