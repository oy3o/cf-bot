import * as config from './config.js'
import * as cf from './adapter-cloudflare.js'
import * as db from './adapter-database.js'
import * as bot from './adapter-telegram.js'
import commands from './commands.js'
//import cohere from './bot-cohere.js'
//import gemini from './bot-gemini.js'
//import mistral from './bot-mistral.js'
import { User, Chat } from './chat.js'
import html_404 from './404.js'

function OK(payload = '') { return new Response(payload, { status: 200, headers: config.corsHeaders }) }
function Created(payload = '') { return new Response(payload, { status: 201, headers: config.corsHeaders }) }
function BadRequest(payload = '') { return new Response(payload, { status: 400, headers: config.corsHeaders }) }
function Unauthorized(payload = '') { return new Response(payload, { status: 401, headers: config.corsHeaders }) }
function Forbidden(payload = '') { return new Response(payload, { status: 403, headers: config.corsHeaders }) }
function NotFound(payload = '') { return new Response(payload, { status: 404, headers: config.corsHeaders }) }
function OverRate(payload = '') { return new Response(payload, { status: 429, headers: config.corsHeaders }) }
function ServerError(payload = '') { return new Response(payload, { status: 500, headers: config.corsHeaders }) }

const Sleep = ms => new Promise(ok => setTimeout(ok, ms))

function splitByFirst(argsText, splitter) {
    const index = argsText.indexOf(splitter)
    if (index !== -1)
        return [argsText.substring(0, index), argsText.substring(index + 1).trim()]
    else
        return [argsText, '']
}

for (const command of [
    //    ...cohere.commands,
    //    ...gemini.commands,
    //    ...mistral.commands,
]) commands.register(...command)
commands.registerDefault()

export default {
    fetch: async (req, env, ctx) => {
        if (req.method === 'OPTIONS') return OK()

        const url = new URL(req.url)
        const module = url.pathname.split('/')[1]

        if (module === 'message') {
            if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.BOT_SECRET) return Unauthorized()

            const tgRequest = await req.json()

            if (tgRequest.message) {
                const tgMessage = tgRequest.message
                const newMember = tgMessage.new_chat_member
                if (newMember) {
                    //ctx.waitUntil(bot.sendMessage(tgMessage.chat_id, `欢迎加入群组 @${newMember.username}`, env))
                    return OK()
                }

                const text = tgMessage.text
                const context = {
                    sudo: tgMessage.from.id === env.BOT_ADMIN,
                    isbot: tgMessage.from.is_bot,
                    date: tgMessage.date,
                    chattype: tgMessage.chat.type,
                    chatid: tgMessage.chat.id,
                    userid: tgMessage.from.id,
                    username: tgMessage.from.username,
                    messageid: tgMessage.message_id,
                    text: tgMessage.text,
                    audio: tgMessage.audio?.file_id || null,
                    document: tgMessage.document?.file_id || null,
                    photo: tgMessage.photo?.pop()?.file_id || null,
                    video: tgMessage.video?.file_id || null,
                    voice: tgMessage.voice?.file_id || null,
                }

                const user = new User(await db.getUser(context.userid, env) || context)
                const chat = new Chat(user.chats[context.chatid] || config.DefaultChatContext)

                context.user = user
                context.chat = chat

                if ((env.BOT_IS_PUBLIC || context.sudo) && text[0] === '/') {
                    const [instr, args] = splitByFirst(text, ' ')
                    ctx.waitUntil(commands.execute(instr, args, context, env))
                    return OK()
                }

                if (env.BOT_IS_PUBLIC || context.sudo) {
                    const chat = context.chat
                    const waiting = chat.waiting
                    waiting && context[waiting.type] && ctx.waitUntil(waiting.reply(context[waiting.type], context, env))
                }

                return OK()
            }

            if (tgRequest.callback_query) {
                const callbackQuery = tgRequest.callback_query
                const data = callbackQuery.data
                const tgMessage = callbackQuery.message
                const context = {
                    sudo: callbackQuery.from.id === env.BOT_ADMIN,
                    isbot: tgMessage.from.is_bot,
                    date: tgMessage.date,
                    chattype: tgMessage.chat.type,
                    chatid: tgMessage.chat.id,
                    userid: callbackQuery.from.id,
                    username: callbackQuery.from.username,
                    messageid: tgMessage.message_id,
                }

                const user = new User(await db.getUser(context.userid, env) || context)
                const chat = new Chat(user.chats[context.chatid] || config.DefaultChatContext)

                context.user = user
                context.chat = chat

                if (data.startsWith('!0,') && data.endsWith(',"close"'))
                    ctx.waitUntil(bot.deleteMessage(context.chatid, context.messageid, env))
                const waiting = context.chat.waiting

                waiting ?
                    ctx.waitUntil(waiting.reply(data, context, env)) :
                    ctx.waitUntil(async () => {
                        const res = await bot.sendMessage(context.chatid, `@${context.username} 不支持的操作`, env)
                        if (res.ok) {
                            await Sleep(3000)
                            return bot.deleteMessage(context.chatid, res.result.message.message_id, env)
                        }
                    })
            }

            if (tgRequest.edited_message) {

            }

            return OK()
        }

        const params = new URLSearchParams(url.search)
        if (params.get('token') !== env.CF_WORKER_TOKEN)
            return new Response(html_404, {
                status: 404,
                headers: {
                    "content-type": "text/html;charset=UTF-8",
                }
            })

        switch (module) {
            case 'setup': {
                ctx.waitUntil(bot.setMyCommands(commands.descriptions(), env))
                ctx.waitUntil(bot.getMe(env).then(async res => {
                    if (res.ok) {
                        const BOT_NAME = {
                            type: 'secret_text',
                            name: 'BOT_NAME',
                            text: res.result.username,
                        }
                        return cf.putWorkerSecret(env.CF_WORKER_ID, BOT_NAME, env)
                    }
                }))

                return bot.setWebhook(env.CF_WORKER_ENDPOINT + '/message', env)
            }
            case 'shutdown': {
                ctx.waitUntil(bot.deleteMyCommands(env))
                return bot.deleteWebhook(env)
            }
            default:
                return OK(JSON.stringify({
                    request: {
                        headers: Object.fromEntries(req.headers.entries())
                    }
                }, null, 2))
        }
    }
}
