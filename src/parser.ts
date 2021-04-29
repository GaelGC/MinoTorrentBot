import { Result } from "typescript-result";
import { TorrentState } from "./torrent";
import discord = require('discord.js');
import { RemindState } from "./reminder";
import { get_discord_manager } from "./discord_manager";

function split_line(line: string): Result<Error, string[]> {
    // Remove all useless spaces
    const trimmed = line.replace(/\s+/g, ' ').trim().split(' ');

    // Resulting strings
    var dequoted_res: string[] = new Array();

    // When in quote mode, stores the current string buffer
    var quote_buffer = "";
    var in_quote = false;

    for (var idx = 0; idx < trimmed.length; idx++) {
        const cur_str = trimmed[idx];
        const trimmed_str = cur_str.replace(/"/g, "");
        if (cur_str.length > trimmed_str.length + 2) {
            return Result.error(new Error(`Invalid argument ${cur_str}.`));
        }
        const quote_pos = cur_str.indexOf("\"");
        const last_quote_pos = cur_str.lastIndexOf("\"");
        // We check that the pattern is either X or X" if we are already in a quote.
        if (in_quote && !([-1, cur_str.length - 1].includes(quote_pos))) {
            return Result.error(new Error(
                `Invalid argument ${cur_str}. Expected quotes to be at the end.`));
        }
        // We check that the pattern is either "X, X or "X" if we are not in a quote.
        if (!in_quote && ((quote_pos !== -1 && quote_pos !== 0) ||
            (last_quote_pos !== quote_pos && last_quote_pos !== cur_str.length - 1))) {
            return Result.error(new Error(
                `Invalid argument ${cur_str}. Expected quotes to be at the beginning` +
                " and optionally end."));
        }

        if (quote_pos === -1) {
            if (in_quote) {
                quote_buffer += " " + trimmed_str;
            } else {
                dequoted_res.push(trimmed_str);
            }
        }
        if (quote_pos === 0) {
            in_quote = true;
            quote_buffer = trimmed_str;
        } else if (last_quote_pos === cur_str.length - 1) {
            quote_buffer += " " + trimmed_str;
        }
        if (last_quote_pos === cur_str.length - 1) {
            in_quote = false;
            dequoted_res.push(quote_buffer);
        }
    }
    if (in_quote) {
        return Result.error(new Error("Invalid line: Unended quote."));
    }
    return Result.ok(dequoted_res);
}

export function split_message(message: string): Result<Error, string[][]> {
    var res: string[][] = new Array();
    var lines = message.split('\n');

    for (var idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (line.trim().length === 0) {
            continue;
        }
        const splitted = split_line(line);
        if (splitted.isFailure()) {
            return Result.error(new Error(
                `error on line ${line}\n${splitted.error.message}`));
        } else {
            res.push(splitted.value)
        }
    }
    return Result.ok(res);
}

function parse_reminder(message: discord.Message, line: string[], pos: number): Result<string, [RemindState, number]> {
    if (line.length <= pos + 1) {
        return Result.error("Invalid usage for remind command. Usage: remind <date> <mentions without @>");
    }
    const date = Date.parse(line[pos]);
    const mentions = line[pos + 1];

    if (isNaN(date)) {
        return Result.error("Invalid date " + line[pos]);
    }
    const mention_str = get_discord_manager().get_mentions(mentions.split(" "), message.guild!);
    if (mention_str.isFailure()) {
        return mention_str.forward();
    }
    return Result.ok([new RemindState(date, mention_str.value, message), pos + 2]);
}

export function parse_line(message: discord.Message, line: string[]): Result<string, TorrentState> {
    var torrent = new TorrentState(line[0], message);
    var line_idx = 1;
    while (line_idx !== -1 && line_idx !== line.length) {
        const key = line[line_idx];
        if (key === "remind") {
            const reminder = parse_reminder(message, line, line_idx + 1);
            if (reminder.isFailure()) {
                torrent.kill(true);
                return reminder.forward();
            }
            [torrent.reminder, line_idx] = reminder.value;
        } else {
            torrent.kill(true);
            return Result.error(`Invalid command ${key}`);
        }
    }
    return Result.ok(torrent);
}