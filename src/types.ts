import discord = require('discord.js');
import { Result } from 'typescript-result';
import WebTorrent = require('webtorrent');
import { get_discord_manager } from './discord_manager';

const remote_out_dir = "http://server_address/";

export class RemindState {
    constructor(date: number, mentions: string[]) {
        this.date = date;
        this.mentions = mentions;
    }
    private date: number;
    private mentions: string[];

    timer_expired(): boolean {
        return Date.now() - this.date > 0;
    }
};

export class TorrentState {
    constructor(hash: string, url: string, message: discord.Message) {
        this.url = url;
        this.hash = hash;
        this.message = message;
        this.embed_message = undefined;
        this.last_update = Date.now();
        this.reminder = undefined;
        this.embed = new discord.MessageEmbed()
            .setAuthor("MinoTorrentBot")
            .setDescription("Temporary post")
            .setTitle(url)
            .addField('url', url);
    }

    send_embed() {
        this.embed_message = this.message.channel.send(this.embed);
    }

    private reply_to_message(response: string) {
        const fake_message: any = this.message;
        fake_message.lineReply(response);
    }

    private _update_embed(torrent: WebTorrent.Torrent, percent: number,
        important: boolean = false): Result<string, void> {
        const state_update = this.update_state(percent);
        if (state_update.isFailure()) {
            return Result.error(state_update.error);
        }

        this.embed_message = this.embed_message!.then((message) => {
            this.embed!.setTitle(torrent.name);

            if (torrent.done) {
                const hash = this.hash;
                var description = "";
                torrent.files.forEach((file) => {
                    var path = file.path;
                    path = path.replace(/ /g, "%20");
                    path = path.replace(/\(/g, "%28");
                    path = path.replace(/\)/g, "%29");
                    description += `[${file.name}](${remote_out_dir}/${hash}/${path})` + '\n';
                    console.log(description);
                });
                description += `<@${this.message.author.id}>`;
                this.embed!.setDescription(description);
            }
            var edit = message.edit(this.embed!);
            if (torrent.done && important && percent !== 0) {
                edit = edit.then((message) => {
                    this.reply_to_message(`Download for ${this.url} finished. See ${message.url} for details`);
                    return message;
                });
            }
            return edit;
        });
        return Result.ok();
    }

    update_embed(torrent: WebTorrent.Torrent, percent: number,
        important: boolean = false) {
        if (important || Date.now() - this.last_update > 5000) {
            const res = this._update_embed(torrent, percent, important);
            if (res.isSuccess()) {
                this.last_update = Date.now();
            } else if (important) {
                this.reply_to_message(`error: ${res.error}`);
            }
        }
    }

    private update_state(percent: number): Result<string, discord.MessageEmbed> {
        percent = (percent + 0.001) | 0;
        const state_str = get_discord_manager().state_str(percent);
        if (state_str.isFailure()) {
            return Result.error(state_str.error);
        }

        // Remove the old state if any
        const oldIdx = this.embed!.fields.findIndex((elem) => elem.name === 'state');
        if (oldIdx !== -1) {
            this.embed!.fields.splice(oldIdx, 1);
        }
        this.embed!.addField("state", state_str.value);
        return Result.ok(this.embed);
    }

    private embed: discord.MessageEmbed;
    url: string;
    hash: string;
    message: discord.Message;
    private embed_message: Promise<discord.Message> | undefined;
    private last_update: number;
    reminder: RemindState | undefined;
};