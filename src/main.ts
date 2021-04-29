require('dotenv').config()
import discord = require('discord.js');
require('discord-reply');
import webTorrent = require('webtorrent');
import { TorrentState } from './torrent';
import { parse_line, split_message } from './parser';
import { get_discord_manager, initialize_discord_manager } from './discord_manager';
import { Result } from 'typescript-result';

const client = new discord.Client();
initialize_discord_manager(client);

function reply_to_message(message: discord.Message, response: string) {
    const fake_message: any = message;
    fake_message.lineReply(response);
}

function handle_line(message: discord.Message, line: string[]): Result<string, void> {
    const torrent = parse_line(message, line);
    if (torrent.isFailure()) {
        return torrent.forward();
    }
    return Result.ok();
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
        var failures = "Failed to handle the following lines:\n";
        var failed = false;
        for (var line of splitted.value) {
            const res = handle_line(message, line);
            if (res.isFailure()) {
                failures += `"${line}": ${res.error}\n`;
                failed = true;
            }
        }
        if (failed) {
            reply_to_message(message, failures);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);