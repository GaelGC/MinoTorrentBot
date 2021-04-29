import discord = require('discord.js');
import { Result } from 'typescript-result';
import { get_discord_manager } from './discord_manager';

function reply_to_message(message: discord.Message, response: string) {
    const fake_message: any = message;
    fake_message.lineReply(response);
}

export class RemindState {
    constructor(date: number, mentions: string,
        message: discord.Message) {
        this.date = date;
        this.mentions = mentions;
        this.message = message;
    }

    private date: number;
    private mentions: string;
    private sent: boolean = false;
    private message: discord.Message;
    private result_message: string | undefined = undefined;

    serialize() {
        var obj = {};
        obj["date"] = this.date;
        obj["mentions"] = this.mentions;
        obj["sent"] = this.sent;
        obj["guild"] = this.message.guild?.id;
        obj["channel"] = this.message.channel.id;
        obj["message"] = this.message.id;
        if (this.result_message !== undefined) {
            obj["result_message"] = this.result_message
        }
        return obj;
    }

    static async parse(val: any): Promise<Result<string, RemindState>> {
        const message = await get_discord_manager().find_message(val["guild"], val["channel"], val["message"]);
        if (message.isFailure()) {
            return message.forward();
        }
        var state = new RemindState(val["date"], val["mentions"], message.value);
        state.sent = val["sent"];
        state.result_message = val["result_message"];
        return Result.ok(state);
    }

    set_result_url(url: string) {
        this.result_message = url;
    }

    kill() {
        this.sent = true;
    }

    tick() {
        if (!this.finished() && this.timer_expired() && this.result_message !== undefined) {
            reply_to_message(this.message, `${this.mentions}, here is your reminder for ${this.result_message}`);
            this.sent = true;
        }
    }

    timer_expired(): boolean {
        return Date.now() - this.date > 0;
    }

    finished(): boolean {
        return this.sent;
    }
};