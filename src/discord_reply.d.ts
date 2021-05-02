import { Message } from "discord.js";

declare module "discord.js" {
    interface Message {
        lineReply(response: string): Promise<Message>;
    }
}