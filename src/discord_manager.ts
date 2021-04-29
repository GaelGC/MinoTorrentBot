import discord = require('discord.js');
import { Result } from 'typescript-result';

class DiscordManager {
    client: discord.Client;
    constructor(client: discord.Client) {
        this.client = client;
    }

    get_emoji(name: string): Result<string, discord.GuildEmoji> {
        const emoji = this.client.emojis.cache.find(emoji => emoji.name === name);
        if (emoji !== undefined) {
            return Result.ok(emoji);
        }
        return Result.error(`Unable to find emoji ${name}. Please contact an administrator.`);
    }

    private state_emojis: discord.Emoji[] | undefined = undefined;
    private get_state_emojis(): Result<string, discord.Emoji[]> {
        if (this.state_emojis === undefined) {
            var emojis: discord.Emoji[] = new Array();
            for (var x = 0; x < 11; x++) {
                const emoji = this.get_emoji(`torrent_${10 * x}`);
                if (emoji.isFailure()) {
                    return Result.error(emoji.error);
                } else {
                    emojis.push(emoji.value);
                }
            }
            this.state_emojis = emojis;
        }
        return Result.ok(this.state_emojis);
    }

    state_str(percent: number): Result<string, string> {
        const emojis_res = this.get_state_emojis();
        if (emojis_res.isFailure()) {
            return Result.error(emojis_res.error);
        }
        const emojis = emojis_res.value;

        var res: string = "";
        const tens = percent / 10;
        const units = percent % 10;
        for (var iter = 0; iter < 10; iter++) {
            if (tens > iter) {
                res += emojis[10].toString();
            } else if (iter == tens) {
                res += emojis[units].toString();
            } else {
                res += emojis[0].toString();
            }
        }
        res += ` ${percent}%`;
        return Result.ok(res);
    }

    has_mention(message: discord.Message): Result<boolean, string> {
        var ids: string[] = new Array();
        ids.push(this.client.user!.id);

        if (message.guild !== null) {
            const my_role = message.guild.roles.cache.find(role => role.name === "MinoTorrentBot");
            if (my_role !== undefined) {
                ids.push(my_role.id);
            }
        }

        const text = message.content;
        const regex = RegExp(`<@[!&]?(${ids.join('|')})>`, "g");
        const matches = text.match(regex);
        if (!matches) {
            return Result.error(false);
        }

        return Result.ok(text.replace(regex, ""));
    }

    get_mention(name: string, guild: discord.Guild): Result<string, string> {
        const user = guild.members.cache.find((user) =>
            user.displayName.replace(" ", "_") === name || user.nickname?.replace(" ", "_") === name ||
            user.id.includes(name) || user.user.tag == name);
        const role = guild.roles.cache.find((role) =>
            role.name.replace(" ", "_") === name || role.id.includes(name));
        if (user !== undefined) {
            return Result.ok(`<@${user.id}>`);
        } else if (role !== undefined) {
            return Result.ok(`<@&${role.id}>`);
        } else {
            return Result.error(`Unable to find any match for ${name}`);
        }
    }

    get_mentions(names: string[], guild: discord.Guild): Result<string, string> {
        var results: string[] = new Array();
        for (var name of names) {
            const res = this.get_mention(name, guild);
            if (res.isFailure()) {
                return res.forward();
            }
            results.push(res.value);
        }
        return Result.ok(results.join(" "));
    }
}

var singleton: DiscordManager;

export function initialize_discord_manager(client: discord.Client) {
    singleton = new DiscordManager(client);
}

export function get_discord_manager(): DiscordManager {
    return singleton;
}