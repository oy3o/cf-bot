import * as cf from './adapter-cloudflare.js'
import * as bot from './adapter-telegram.js'
import { escapeHTML } from './lib-tg-md.js'

export default [
    '/env', '管理 Cloudflare 环境变量',
    async (data, ctx, env) => {
        const instr = '/env'
        // 默认参数
        const defaultArgs = { action: 'list', worker: null, name: null, type: null, value: null }
        // 解析回调参数
        const args = typeof data === 'object' ? { ...defaultArgs, ...data } : defaultArgs
        let { action, worker, name, type, value, confirm } = args
        // 非回调, 手动解析
        if (data && args === defaultArgs) {
            [action, worker, name, type, ...value] = data.split(' ')
            value = value.join(' ')
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

        const exec = async (action) => {
            switch (action) {
                case 'list': {
                    const res = await cf.getWorkers(ctx.user)

                    if (!res.ok) return Emit(res.result)

                    const workers = res.result || []
                    if (!(workers?.length > 0))
                        return Emit('<code>0</code> 个 Worker 被发现.')

                    await Wait('worker', 'text', {
                        action: 'keys',
                        worker: null,
                    })
                    return Emit('请选择需要管理的 Worker:', workers.map(worker => {
                        const name = worker.id
                        return [{
                            text: name,
                            callback_data: WaitData('worker', name)
                        }]
                    }))
                }

                case 'keys':
                case 'values': {
                    if (!worker) return exec('list')

                    const res = await cf.getWorkerBindings(worker, ctx.user)

                    if (!res.ok) return Emit(res.result)

                    const settings = res.result || {}
                    const bindings = settings.bindings || []
                    const envBindings = bindings.filter(b => b.type === 'plain_text' || b.type === 'secret_text')

                    if (action === 'values') {
                        await Wait('action', 'data')
                        return Emit(
                            `<b>Worker</b>: <code>${worker}</code>${envBindings.length ? '\n\n<b>环境变量列表:</b>' : ' 没有环境变量.'}\n\n` +
                            envBindings.map(binding =>
                                `<code> Name</code>: <code>${binding.name}</code>\n` +
                                `<code> Type</code>: <code>${binding.type}</code>\n` +
                                `<code>Value</code>: <code>${binding.type === 'secret_text' ? '[[secret]]' : escapeHTML(binding.text)}</code>\n`
                            ).join('\n'),
                            [[
                                { text: '返回列表', callback_data: WaitData('action', 'keys') }
                            ]]
                        )
                    } else {
                        const buttons = envBindings.map(({ name }) => [{
                            text: name,
                            callback_data: WaitData('name', name)
                        }])

                        buttons.push(
                            [{
                                text: '查看详情',
                                callback_data: WaitData('action', 'values')
                            }],
                            [{
                                text: '添加变量',
                                callback_data: WaitData('action', 'add')
                            }]
                        )

                        await Wait('name', 'text', {
                            action: 'manage',
                            type: null,
                            value: null,
                            confirm: null,
                        })
                        return Emit(`<b>Worker</b>: <code>${worker}</code>\n请选择动作或需要管理的变量:`, buttons)
                    }
                }

                case 'manage': {
                    if (!worker) return exec('list')
                    if (!name) return exec('keys')

                    const res = await cf.getWorkerBindings(worker, ctx.user)

                    if (!res.ok) return Emit(res.result)

                    const settings = res.result || {}
                    const bindings = settings.bindings || []
                    const binding = bindings.find(b => b.name === name)

                    await Wait('action', 'data')
                    return Emit(
                        `<code>Worker</code>: <code>${worker}</code>\n` +
                        `<code>  Name</code>: <code>${binding.name}</code>\n` +
                        `<code>  Type</code>: <code>${binding.type}</code>\n` +
                        `<code> Value</code>: <code>${binding.type === 'secret_text' ? '[[secret]]' : escapeHTML(binding.text)}</code>\n`,
                        [
                            [{ text: '修改', callback_data: WaitData('action', 'mod') }],
                            [{ text: '删除', callback_data: WaitData('action', 'del') }],
                            [{ text: '返回', callback_data: WaitData('action', 'keys') }],
                        ]
                    )
                }

                case 'add': {
                    if (!worker) return exec('list')

                    if (!name) {
                        await Wait('name', 'text')
                        return Emit('请输入变量名:')
                    }

                    if (!type) {
                        await Wait('type', 'data')
                        return Emit('请选择变量类型:', [
                            [{
                                text: '明文(plain_text)',
                                callback_data: WaitData('type', 'plain_text')
                            }],
                            [{
                                text: '密文(secret_text)',
                                callback_data: WaitData('type', 'secret_text')
                            }]
                        ])
                    }

                    if (value === null || value === undefined) {
                        await Wait('value', 'text')
                        return Emit(`请输入变量 <code>${name}</code> 的值:`)
                    }

                    if (!confirm) {
                        await Wait('confirm', 'data')
                        return Emit(
                            `<b>确认添加环境变量?</b>\n` +
                            `<code>Worker</code>: <code>${worker}</code>\n` +
                            `<code>  Name</code>: <code>${name}</code>\n` +
                            `<code>  Type</code>: <code>${type}</code>\n` +
                            `<code> Value</code>: <code>${escapeHTML(value)}</code>\n`,
                            [[
                                { text: '是', callback_data: WaitData('confirm', true) },
                                { text: '否', callback_data: WaitData('action', 'keys') },
                            ]]
                        )
                    }

                    let res
                    if (type === 'plain_text') {
                        const old = await cf.getWorkerBindings(worker, ctx.user)

                        if (!old.ok) return Emit(old.result)

                        const settings = old.result || {}
                        let bindings = settings.bindings?.filter(b => b.name !== name) || []
                        bindings.push({ name, type, text: value })

                        res = await cf.putWorkerBindings(worker, bindings, ctx.user)
                    } else {
                        // 对于secret_text，使用专门的API
                        res = await cf.putWorkerSecret(worker, { name, type, text: value }, ctx.user)
                    }

                    if (!res.ok) return Emit(res.result)

                    await Wait('action', 'data')
                    return Emit('添加成功', [[
                        { text: '返回列表', callback_data: WaitData('action', 'keys') }
                    ]])
                }

                case 'mod': {
                    if (!worker) return exec('list')

                    if (!name) return exec('keys')

                    const old = await cf.getWorkerBindings(worker, ctx.user)

                    if (!old.ok) return Emit(old.result)

                    const settings = old.result || {}
                    const bindings = settings.bindings || []
                    const binding = bindings.find(b => b.name === name)
                    type = binding.type

                    if (value === null || value === undefined) {
                        await Wait('value', 'text')
                        return Emit(
                            `<b>当前环境变量:</b>\n` +
                            `<code>Worker</code>: <code>${worker}</code>\n` +
                            `<code>   Key</code>: <code>${name}</code>\n` +
                            `<code>  Type</code>: <code>${type}</code>\n` +
                            `<code> Value</code>: <code>${type === 'secret_text' ? '[[secret]]' : escapeHTML(binding.text)}</code>\n` +
                            `<b>请输入修改值:</b>\n`,
                            [
                                [{ text: '置空', callback_data: WaitData('value', '') }],
                                [{ text: '取消', callback_data: WaitData('action', 'manage') }],
                            ]
                        )
                    }

                    if (!confirm) {
                        await Wait('confirm', 'data')
                        return Emit(
                            `<b>确认修改环境变量?</b>\n` +
                            `<code>  Worker</code>: <code>${worker}</code>\n` +
                            `<code>     Key</code>: <code>${name}</code>\n` +
                            `<code>    Type</code>: <code>${type}</code>\n` +
                            `<code>OldValue</code>: <code>${type === 'secret_text' ? '[[secret]]' : escapeHTML(binding.text)}</code>\n` +
                            `<code>NewValue</code>: <code>${escapeHTML(value)}</code>`,
                            [[
                                { text: '是', callback_data: WaitData('confirm', true) },
                                { text: '否', callback_data: WaitData('action', 'manage') },
                            ]]
                        )
                    }

                    let res
                    if (type === 'plain_text') {
                        binding.text = value
                        res = await cf.putWorkerBindings(worker, bindings, ctx.user)
                    } else {// secret_text
                        res = await cf.putWorkerSecret(worker, { name, type, text: value }, ctx.user)
                    }

                    if (!res.ok) return Emit(res.result)

                    await Wait('action', 'data')
                    return Emit('修改成功', [[
                        { text: '返回列表', callback_data: WaitData('action', 'keys') }
                    ]])
                }

                case 'del': {
                    if (!worker) return exec('list')
                    if (!name) return exec('keys')

                    const old = await cf.getWorkerBindings(worker, ctx.user)

                    if (!old.ok) return Emit(old.result)

                    const settings = old.result || {}
                    const bindings = settings.bindings || []
                    const binding = bindings.find(b => b.name === name)
                    type = binding.type

                    if (!confirm) {
                        await Wait('confirm', 'data')
                        return Emit(
                            `<b>确认删除环境变量?</b>\n` +
                            `<code>Worker</code>: <code>${worker}</code>\n` +
                            `<code>   Key</code>: <code>${name}</code>\n` +
                            `<code>  Type</code>: <code>${type}</code>\n` +
                            `<code> Value</code>: <code>${type === 'secret_text' ? '[[secret]]' : escapeHTML(binding.text)}</code>\n`,
                            [[
                                { text: '是', callback_data: WaitData('confirm', true) },
                                { text: '否', callback_data: WaitData('action', 'manage') },
                            ]]
                        )
                    }

                    let res = type === 'plain_text' ?
                        await cf.putWorkerBindings(worker, bindings.filter(b => b.name !== name), ctx.user) :
                        await cf.deltWorkerSecret(worker, name, ctx.user)

                    if (!res.ok) return Emit(res.result)

                    await Wait('action', 'data')
                    return Emit('删除成功', [[
                        { text: '返回列表', callback_data: WaitData('action', 'keys') }
                    ]])
                }

                default:
                    return Emit(`Unknown action in /env: ${action}`)
            }
        }

        try {
            return exec(action)
        } catch (e) {
            return Emit(`An unexpected error occurred: <pre>${e.message}</pre>`)
        }
    }
]