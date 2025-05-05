import { putUser } from './adapter-database.js'
import { CommandWait } from './commands.js'

export class User {
    constructor(ctx) {
        if (typeof ctx === 'string') {
            // User string
            Object.assign(this, JSON.parse(ctx))
        } else {
            // MsgContext
            this.sudo = ctx.sudo
            this.userid = ctx.userid
            this.username = ctx.username
            this.chats = ctx.chats || {}

            // Public BOT Cloudflare
            this.CF_ACCOUNT_ID = null
            this.CF_API_TOKEN = null
        }
    }
}
/*
export class ChatMessage {
    constructor(msgid, role, content) {
        this.id = msgid
        this.role = role
        this.content = content
    }
}
*/
export class Chat {
    constructor(ctx) {
        /*this.model = ctx.model
        this.stream = ctx.stream
        this.temperature = ctx.temperature

        this.cache = ctx.cache
        this.messages = ctx.messages*/

        this.chatid = ctx.chatid
        this.waiting = ctx.waiting && new CommandWait(ctx.waiting)
    }

    async send(MsgContext) {

    }

    async wait(wait, ctx, env) {
        this.waiting = new CommandWait(wait)
        ctx.user.chats[ctx.chatid] = this
        return putUser(ctx.userid, ctx.user, env)
    }

    async unwait(ctx, env) {
        this.waiting = null
        ctx.user.chats[ctx.chatid] = this
        return putUser(ctx.userid, ctx.user, env)
    }
}
