import * as db from './adapter-database.js'
import * as bot from './adapter-telegram.js'
import command_env from './command-env.js'
import command_db from './command-db.js'

class Commands {
    #commands = new Map()

    register(command, description, handler) {
        this.#commands.set(command, { description, handler })
    }

    async execute(instr, args = '', ctx, env) {
        if (typeof instr !== 'string' || !instr.startsWith('/')) {
            return { ok: false, result: 'Please enter a valid command starting with /.' }
        }

        const command = this.#commands.get(instr)
        if (!command) return { ok: false, result: `Unknown command: ${command}\nUse /help to see available commands.` }

        if (instr === '/start' || instr === '/help' || instr === '/login') return command.handler(args, ctx, env)

        try {
            if (ctx.user.CF_ACCOUNT_ID && ctx.user.CF_API_TOKEN) return command.handler(args, ctx, env)
            return bot.sendMessage(ctx.chatid, 'please enter /login at first', env)
        } catch (error) {
            return { ok: false, result: `Command Executing Error for ${command}: ${error.message}` }
        }
    }

    descriptions() {
        return Array.from(this.#commands.entries()).map(
            ([command, { description }]) => ({command, description})
        )
    }

    menu() {
        if (this.#commands.size === 0) return 'No commands are currently available.'

        return this.descriptions()
            .reduce((menuText, {command, description}) => {
                return menuText + `<code>${command}</code> - ${description}\n`
            }, '')
            .trim()
    }

    registerDefault() {
        this.register(
            '/start',
            '启动BOT, 测试连通性',
            async (data, ctx, env) => {
                const logged = ctx.user.CF_ACCOUNT_ID && ctx.user.CF_API_TOKEN
                const welcomeMessage =
                    `<code>${env.BOT_NAME}</code> <b>⭐连接成功⭐</b>\n` +
                    `<code> -     sudo</code>: <code>${ctx.sudo}</code>\n` +
                    `<code> -     date</code>: <code>${ctx.date}</code>\n` +
                    `<code> - chattype</code>: <code>${ctx.chattype}</code>\n` +
                    `<code> -   chatid</code>: <code>${ctx.chatid}</code>\n` +
                    `<code> -   userid</code>: <code>${ctx.userid}</code>\n` +
                    `<code> - username</code>: <code>${ctx.username}</code>\n` +
                    `<code> -   status</code>: <code>${logged ? 'Logged in' : 'Not logged in'}</code>\n` +
                    'enter /env or /db to manager cloudflare Env Bindings or KVNamespace\n' +
                    `${logged ? '' : 'please enter /login at first'}`
                return bot.sendMessage(ctx.chatid, welcomeMessage, env)
            }
        )
        this.register(
            '/help',
            '查看菜单',
            async (data, ctx, env) => {
                return bot.sendMessage(ctx.chatid, this.menu(), env)
            }
        )

        this.register(
            '/login',
            '登录 cloudflare',
            async (data, ctx, env) => {
                const instr = '/login'
                // 默认参数
                const defaultArgs = { accountid: null, token: null }
                // 解析回调参数
                const args = typeof data === 'object' ? { ...defaultArgs, ...data } : defaultArgs
                let { accountid, token } = args
                // 非回调, 手动解析
                if (data && args === defaultArgs) {
                    [accountid, token] = data.split(' ')
                }

                const Wait = (waiting, type = 'text', update = {}) => {
                    // 既然在等待, 我们清空当前值
                    args[waiting] = null
                    // 如果存在默认参数, 我们更新
                    Object.assign(args, update)
                    // 在会话注册等待
                    return ctx.chat.wait({ instr, args, waiting, type }, ctx, env)
                }
                const WaitAction = (action) => '!' + JSON.stringify(([0, instr, action])).slice(1, -1)
                const WaitData = (name, value) => '!' + JSON.stringify(([1, instr, name, value])).slice(1, -1)

                async function Emit(text, buttons = []) {
                    const withButtons = buttons.length ? { reply_markup: { inline_keyboard: buttons.concat([[{ text: '关闭', callback_data: WaitAction('close') }]]) } } : {}
                    return ctx.isbot ?
                        bot.editMessageText(ctx.chatid, ctx.messageid, text, env, withButtons) :
                        bot.sendMessage(ctx.chatid, text, env, withButtons)
                }

                const exec = async () => {
                    if (!accountid) {
                        await Wait('accountid', 'text')
                        return Emit('请输入 CF_ACCOUNT_ID:\nhttps://dash.cloudflare.com/&lt;CF_ACCOUNT_ID&gt;/home/domains')
                    }

                    if (!token) {
                        await Wait('token', 'text')
                        // link generator by https://cfdata.lol/tools/api-token-url-generator/
                        return Emit(`请输入 CF_API_TOKEN:\n<a href='https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%5D&name=&accountId=*&zoneId=all'>快速生成</a>`)
                    }
                    const login = await db.list({
                        CF_ACCOUNT_ID: accountid,
                        CF_API_TOKEN: token,
                    })
                    if (login.ok) {
                        ctx.user.CF_ACCOUNT_ID = accountid
                        ctx.user.CF_API_TOKEN = token
                        await db.putUser(ctx.userid, ctx.user, env)
                        return Emit(`登录成功`)
                    } else {
                        return Emit(login.result)
                    }
                }

                try {
                    return exec()
                } catch (e) {
                    return Emit(`An unexpected error occurred: <pre>${e.message}</pre>`)
                }
            }
        )

        this.register(...command_env)
        this.register(...command_db)
    }
}

const commands = new Commands()

export class CommandWait {
    constructor(wait) {
        this.instr = wait.instr
        this.args = wait.args
        this.waiting = wait.waiting
        this.type = wait.type
    }

    async reply(data, ctx, env) {
        try {
            if (data?.[0] === '!') {
                // callback_data
                switch (data[1]) {
                    case '0': {
                        const [instr, action] = JSON.parse(`[${data.slice(3)}]`)
                        // 空操作不消耗 wait
                        if (action === 'noop') return;
                        // 签名匹配消耗 wait
                        if (instr === this.instr) await ctx.chat.unwait(ctx, env)
                        switch (action) {
                            case 'close': // close 删除对应的消息, 然后直接返回
                                return // 外部已处理
                        }
                    }
                    case '1': {
                        const [instr, name, value] = JSON.parse(`[${data.slice(3)}]`)
                        // 签名不匹配直接返回, 否则消耗 wait
                        if (instr !== this.instr) return;
                        await ctx.chat.unwait(ctx, env)
                        this.args[name] = value
                    }
                }
            } else {
                // message_data
                this.args[this.waiting] = data ?? ctx[this.type]
            }

            // 使用更新的 args 调用命令
            return commands.execute(this.instr, this.args, ctx, env)
        } catch (e) {
            // 意外情况, 可能不是此 bot 的事件, 不处理
        }
    }
}

export default commands