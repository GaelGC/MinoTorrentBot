import discord = require('discord.js');
import { Result } from 'typescript-result';
import WebTorrent = require('webtorrent');
import { get_discord_manager } from './discord_manager';
import CryptoJS = require('crypto-js');

const remote_out_dir = "http://server_address/";
const local_out_dir = "/srv/http";
const webtorrent_client = new WebTorrent();

var torrent_map: Map<WebTorrent.Torrent, TorrentState> = new Map();

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
    constructor(user_url: string, message: discord.Message) {
        [this.torrent, this.url, this.hash] = this.set_torrent(user_url);
        this.message = message;
        this.embed_message = undefined;
        this.last_update = Date.now();
        this.reminder = undefined;
        this.embed = new discord.MessageEmbed()
            .setAuthor("MinoTorrentBot")
            .setDescription("Temporary post")
            .setTitle(this.url)
            .addField('url', this.url);

        this.send_embed();
        this.torrent.resume();
        torrent_map.set(this.torrent, this);
    }

    private set_torrent(url: string): [WebTorrent.Torrent, string, string] {
        console.log(`Downloading ${url}`);

        const hash = CryptoJS.SHA256(url);
        const torrent = webtorrent_client.add(url,
            { path: `${local_out_dir}/${hash}` });
        torrent.pause();

        torrent.on('error', (err) => {
            if (typeof err === "string") {
                this.reply_to_message(`Error on ${this.url}: ${err}`);
            } else {
                this.reply_to_message(`Error on ${this.url}: ${err.message}`);
            }
            torrent_map.delete(torrent);
        });

        torrent.on('ready', () => {
            this.update_embed(torrent, 0, true);
            const emoji = get_discord_manager().get_emoji("torrent_101");

            if (emoji.isSuccess()) {
                this.message.react(emoji.value);
            } else {
                this.message.reply(emoji.error);
            }
        });

        torrent.on('download', () => {
            var cur_progress = (100 * (torrent.progress)) | 0;
            this.update_embed(torrent, cur_progress);
        });

        torrent.on('done', () => {
            this.update_embed(torrent, 100, true, true);
        });

        return [torrent, url, hash];
    }

    send_embed() {
        this.embed_message = this.message.channel.send(this.embed);
    }

    private reply_to_message(response: string) {
        const fake_message: any = this.message;
        fake_message.lineReply(response);
    }

    private _update_embed(torrent: WebTorrent.Torrent, percent: number,
        important: boolean = false, finished: boolean = false): Result<string, void> {
        const state_update = this.update_state(percent);
        if (state_update.isFailure()) {
            return Result.error(state_update.error);
        }

        this.embed_message = this.embed_message!.then((message) => {
            this.embed!.setTitle(torrent.name);

            if (finished) {
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
                console.log("Set desc as " + description);
                torrent_map.delete(torrent);
                torrent.destroy();
            }
            var edit = message.edit(this.embed!);
            if (finished) {
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
        important: boolean = false, finished: boolean = false) {
        if (important || Date.now() - this.last_update > 5000) {
            const res = this._update_embed(torrent, percent, important, finished);
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
    torrent: WebTorrent.Torrent;
};