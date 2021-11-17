import discord = require('discord.js');
import { Result } from 'typescript-result';
import WebTorrent = require('webtorrent');
import { get_discord_manager } from './discord_manager';
import CryptoJS = require('crypto-js');
import { RemindState } from './reminder';
import fs = require('fs');
import { bot_config } from './main';

const webtorrent_client = new WebTorrent();

interface Substitution {
    src: string;
    dst: string;
};

const substitutions: Substitution[] = bot_config["substitutions"];
function apply_substitutions(url: string): string {
    for (const Substitution of substitutions) {
        const regex = new RegExp(Substitution.src, "g");
        url = url.replace(regex, Substitution.dst);
    }
    return url;
}

var torrent_map: Map<WebTorrent.Torrent, TorrentState> = new Map();
setInterval(async function () {
    for (var torrent of Array.from(torrent_map.values())) {
        torrent.tick();
    }
}, 5000);
setInterval(async function () {
    var torrents = Array();
    for (var torrent of Array.from(torrent_map.values())) {
        torrents.push(await torrent.serialize());
    }
    fs.writeFileSync("torrents.json", JSON.stringify(torrents));
}, 30000);

export class TorrentState {
    readonly remote_out_dir = bot_config["remote_directory"];
    readonly local_out_dir = bot_config["local_directory"];
    constructor(user_url: string, message: discord.Message, embed?: discord.MessageEmbed) {
        [this.torrent, this.url, this.hash] = this.set_torrent(user_url);
        this.message = message;
        this.embed_message = undefined;
        this.last_update = Date.now();
        this.reminder = undefined;
        if (embed) {
            this.embed = embed;
        } else {
            this.embed = new discord.MessageEmbed()
                .setAuthor("MinoTorrentBot")
                .setDescription("Temporary post")
                .setTitle(this.url)
                .addField('url', this.url);

            this.send_embed();
        }
        this.torrent.resume();
        torrent_map.set(this.torrent, this);
    }

    async serialize(): Promise<any> {
        var obj = {};
        obj["url"] = this.url;
        obj["embed"] = this.embed.toJSON();
        obj["message"] = this.message.id;
        obj["channel"] = this.message.channel.id;
        obj["guild"] = this.message.guild?.id;
        const paused = this.torrent.paused;
        this.torrent.pause();
        var embed_message = this.embed_message;
        do {
            embed_message = this.embed_message;
            var msg = await embed_message;
            if (msg !== undefined) {
                obj["embed_message"] = msg.id;
                obj["embed_channel"] = msg.channel.id;
                obj["embed_guild"] = msg.guild?.id;
            }
        } while (embed_message !== this.embed_message);
        obj["torrent_finished"] = this.torrent_finished;
        obj["message_sent"] = this.message_sent;
        if (this.reminder !== undefined) {
            obj["reminder"] = this.reminder.serialize();
        }
        if (!paused) {
            this.torrent.resume();
        }
        return obj;
    };

    static async parse(val: any): Promise<Result<string, TorrentState>> {
        var reminder: RemindState | undefined = undefined;
        if (val["reminder"] !== undefined) {
            const reminder_parsed = await RemindState.parse(val["reminder"]);
            if (reminder_parsed.isFailure()) {
                return reminder_parsed.forward();
            }
            reminder = reminder_parsed.value;
        }
        const message = await get_discord_manager().find_message(val["guild"], val["channel"], val["message"]);
        if (message.isFailure()) {
            return message.forward();
        }
        var embed_message: discord.Message | undefined = undefined;
        if (val["embed_message"] !== undefined) {
            const embed_message_res =
                await get_discord_manager().find_message(val["embed_guild"], val["embed_channel"], val["embed_message"]);
            if (embed_message_res.isFailure()) {
                return embed_message_res.forward();
            }
            embed_message = embed_message_res.value;
        }

        const embed = val["embed"] === undefined ? undefined : new discord.MessageEmbed(val["embed"]);
        var torrent = new TorrentState(val["url"], message.value, embed);
        if (embed_message !== undefined) {
            const lambda = async function (embed_message: discord.Message) { return embed_message };
            torrent.embed_message = lambda(embed_message);
        }
        torrent.message_sent = val["message_sent"];
        torrent.torrent_finished = val["torrent_finished"];
        torrent.reminder = reminder;
        return Result.ok(torrent);
    }

    kill(error: boolean = false) {
        this.torrent.destroy();
        this.torrent_finished = true;
        this.reminder?.kill();
        torrent_map.delete(this.torrent);
        if (error) {
            this.embed_message?.then(m => m.delete()).catch(x => console.error(`Error ${x} while deleting the message ${this.message.id}`));
        }
    }

    tick() {
        if (this.torrent_finished) {
            this.reminder?.tick();
        }
        if (this.finished()) {
            this.kill();
        }
    }

    private set_torrent(url: string): [WebTorrent.Torrent, string, string] {
        url = apply_substitutions(url);
        console.log(`Downloading ${url}`);

        const hash = CryptoJS.SHA256(url);
        const torrent = webtorrent_client.add(url,
            { path: `${this.local_out_dir}/${hash}` });
        torrent.pause();

        torrent.on('error', (err) => {
            if (typeof err === "string") {
                this.reply_to_message(`Error on ${this.url}: ${err}`);
            } else {
                this.reply_to_message(`Error on ${this.url}: ${err.message}`);
            }
            torrent.destroy();
            torrent_map.delete(torrent);
        });

        torrent.on('ready', () => {
            this.update_embed(torrent, 0, true);
            const emoji = get_discord_manager().get_emoji("torrent_101");

            if (emoji.isSuccess()) {
                this.message.react(emoji.value).catch(err => console.error(`Got error ${err} while reacting to ${this.message.id}`));
            } else {
                this.reply_to_message(emoji.error);
            }
        });

        torrent.on('download', () => {
            var cur_progress = (100 * (torrent.progress)) | 0;
            this.update_embed(torrent, cur_progress);
        });

        torrent.on('done', () => {
            this.update_embed(torrent, 100, true, true);
            this.embed_message = this.embed_message?.then((m) => {
                this.reminder?.set_result_url(m.url);
                torrent.destroy();
                this.torrent_finished = true;
                return m;
            });
        });

        return [torrent, url, hash];
    }

    send_embed() {
        try {
            this.embed_message = this.message.channel.send(this.embed);
        } catch (err) {
            console.error(`Got error ${err} while sending embed for ${this.message.id}`);
            // TODO: Proper error handling in caller.
            throw err;
        }
    }

    private reply_to_message(response: string) {
        this.message.lineReply(response).catch((err) => console.error(err));;
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
                    description += `[${file.name}](${this.remote_out_dir}/${hash}/${path})` + '\n';
                    console.log(description);
                });
                description += `<@${this.message.author.id}>`;
                this.embed!.setDescription(description);
                console.log("Set desc as " + description);
            }
            var edit = message.edit(this.embed!);
            edit.catch((err) => console.log(err));
            if (finished) {
                edit = edit.then((message) => {
                    if (!this.message_sent) {
                        this.reply_to_message(`Download for ${this.url} finished. See ${message.url} for details`);
                        this.message_sent = true;
                    }
                    return message;
                });
            }
            return edit;
        });
        return Result.ok();
    }

    update_embed(torrent: WebTorrent.Torrent, percent: number,
        important: boolean = false, finished: boolean = false) {
        if (important || Date.now() - this.last_update > 30000) {
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

    finished(): boolean {
        if (!this.torrent_finished) {
            return false;
        }
        if (this.reminder !== undefined && !this.reminder.finished()) {
            return false;
        }
        return true;
    }

    private embed: discord.MessageEmbed;
    url: string;
    hash: string;
    message: discord.Message;
    private embed_message: Promise<discord.Message> | undefined;
    private last_update: number;
    reminder: RemindState | undefined;
    torrent: WebTorrent.Torrent;
    private torrent_finished: boolean = false;
    private message_sent: boolean = false;
};