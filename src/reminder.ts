import discord = require('discord.js');

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