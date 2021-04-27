import discord = require('discord.js');
require('discord-reply');
import webTorrent = require('webtorrent')
import CryptoJS = require('crypto-js');
import { RemindState, TorrentState } from './types';
import { split_message } from './parser';
import { get_discord_manager, initialize_discord_manager } from './discord_manager';

const client = new discord.Client();
const webtorrent_client = new webTorrent();
const local_out_dir = "/srv/http/";
initialize_discord_manager(client);

var torrent_map: Map<webTorrent.Torrent, TorrentState> = new Map();

function reply_to_message(message: discord.Message, response: string) {
    const fake_message: any = message;
    fake_message.lineReply(response);
}

webtorrent_client.on('torrent', (torrent) => {
    var embed = torrent_map.get(torrent);
    if (embed === undefined) {
        return;
    }
    embed.update_embed(torrent, 0, true);
});

function get_torrent(url: string): [webTorrent.Torrent, string, string] {
    console.log(`Downloading ${url}`);

    const hash = CryptoJS.SHA256(url);
    const torrent = webtorrent_client.add(url,
        { path: `${local_out_dir}/${hash}` });
    torrent.pause();
    return [torrent, url, hash];
}

function parse_remind(line: string[], start_idx: number)
    : [RemindState | undefined, number, string | undefined] {
    if (start_idx + 2 >= line.length) {
        return [undefined, -1, "Usage: Remind <date> <groups>"];
    }
    const date_str = line[start_idx + 1];
    const groups_str = line[start_idx + 2];
    start_idx += 3;
    const date = Date.parse(date_str);
    if (isNaN(date)) {
        return [undefined, -1, "Remind: Invalid date " + date_str];
    }
    return [new RemindState(date, [groups_str]), start_idx, undefined];
}

function handle_line(message: discord.Message, line: string[]) {
    const torrent_data = get_torrent(line[0]);
    const torrent = torrent_data[0];
    const url = torrent_data[1];
    const hash = torrent_data[2];

    const torrent_state = new TorrentState(hash, url, message);
    var arg_idx: number = 1;
    var error: String | undefined = undefined;
    while (arg_idx != line.length && arg_idx >= 0) {
        switch (line[arg_idx]) {
            case "remind": {
                var reminder: RemindState | undefined = undefined;
                [reminder, arg_idx, error] = parse_remind(line, arg_idx);
                if (reminder !== undefined) {
                    torrent_state.reminder = reminder;
                }
                break;
            }
            default: {
                error = "Unknown argument " + line[arg_idx];
                arg_idx = -1;
                break;
            }
        }
    }

    if (error !== undefined) {
        torrent.destroy();
        reply_to_message(message, `error: ${error}`);
        return;
    }

    torrent_state.send_embed();
    torrent.resume();
    torrent_map.set(torrent, torrent_state);

    torrent.on('done', function () {
        var embed = torrent_map.get(torrent);
        if (embed === undefined) {
            return;
        }
        embed.update_embed(torrent, 100, true);
        torrent_map.delete(torrent);
        torrent.destroy();
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
        embed.update_embed(torrent, cur_progress);
    });
}

client.on('message', message => {
    if (client.user === null) {
        console.error("Unable to log to Discord.");
        throw new Error();
    }

    const msg = get_discord_manager().has_mention(message);
    if (msg.isFailure()) {
        return;
    }

    const text = msg.value;
    const splitted = split_message(text);
    console.log(splitted)
    if (splitted === undefined) {
        reply_to_message(message, "Invalid empty message.");
        console.error("Received an empty message");
        return;
    }

    if (splitted.isSuccess()) {
        splitted.value.forEach(line => {
            handle_line(message, line);
        });
    }
});

client.login("INSERT YOUR TOKEN HERE");
