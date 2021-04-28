import discord = require('discord.js');
require('discord-reply');
import webTorrent = require('webtorrent');
import { RemindState, TorrentState } from './types';
import { split_message } from './parser';
import { get_discord_manager, initialize_discord_manager } from './discord_manager';

const client = new discord.Client();
initialize_discord_manager(client);

function reply_to_message(message: discord.Message, response: string) {
    const fake_message: any = message;
    fake_message.lineReply(response);
}

function handle_line(message: discord.Message, line: string[]) {
    const torrent_state = new TorrentState(line[0], message);
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
