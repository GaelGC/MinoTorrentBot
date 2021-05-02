import * as discord from 'discord.js';
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
        const tens = Math.floor(percent / 10);
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

    async find_guild(guild_id: string): Promise<Result<string, discord.Guild>> {
        var guild: discord.Guild | undefined;
        guild = this.client.guilds.cache.get(guild_id);
        if (guild !== undefined) {
            return Result.ok(guild);
        }
        try {
            return Result.ok(await this.client.guilds.fetch(guild_id));
        } catch {
            return Result.error(`Unable to find guild ${guild_id}`);
        }
    }

    async find_channel(channel_id, guild?: discord.Guild): Promise<Result<string, discord.Channel>> {
        var channel: discord.Channel | undefined;
        if (guild === undefined) {
            channel = this.client.channels.cache.get(channel_id);
            if (channel !== undefined) {
                return Result.ok(channel);
            }
            try {
                return Result.ok(await this.client.channels.fetch(channel_id));
            } catch {
                return Result.error(`Unable to find channel ${channel_id}`);
            }
        }
        channel = guild.channels.cache.get(channel_id);
        if (channel !== undefined) {
            return Result.ok(channel);
        }
        return Result.error(`Unable to find channel ${channel_id}`);
    }

    async find_message(guild_id: string | undefined, channel_id: string, message_id: string):
        Promise<Result<string, discord.Message>> {
        var guild: discord.Guild | undefined = undefined;
        if (guild_id !== undefined) {
            const res = await this.find_guild(guild_id);
            if (res.isFailure()) {
                return res.forward();
            }
            guild = res.value;
        }
        const res = await this.find_channel(channel_id, guild);
        if (res.isFailure()) {
            return res.forward();
        }
        const channel = res.value;
        if (!channel.isText()) {
            return Result.error(`Channel ${channel_id} is not text-based`);
        }
        const message = channel.messages.cache.get(message_id);
        if (message !== undefined) {
            return Result.ok(message);
        }
        try {
            return Result.ok(await channel.messages.fetch(message_id));
        } catch {
            return Result.error(`Could not find message ${message_id} in ${channel_id}`);
        }
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
            user.displayName.replace(/ /g, "_") === name || user.nickname?.replace(/ /g, "_") === name ||
            user.id.includes(name) || user.user.tag == name);
        const role = guild.roles.cache.find((role) =>
            role.name.replace(/ /g, "_") === name || role.id.includes(name));
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