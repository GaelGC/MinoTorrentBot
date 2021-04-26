import discord = require('discord.js');

export class RemindState {
    constructor(date: number, mentions: string[]) {
        this.date = date;
        this.mentions = mentions;
    }
    private date: number;
    private mentions: string[];

    timer_expired() : boolean {
        return Date.now() - this.date > 0;
    }
};

export class TorrentState {
    constructor(embed: discord.MessageEmbed, hash: string, url: string,
        message: discord.Message) {
        this.embed = embed;
        this.url = url;
        this.hash = hash;
        this.message = message;
        this.embed_message = undefined;
        this.last_update = Date.now()
        this.reminder = undefined;
    }
    embed: discord.MessageEmbed;
    url: string;
    hash: string;
    message: discord.Message;
    embed_message: Promise<discord.Message> | undefined;
    last_update: number;
    reminder: RemindState | undefined;
};