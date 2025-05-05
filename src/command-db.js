import * as db from './adapter-database.js'
import * as bot from './adapter-telegram.js'
import { escapeHTML } from './lib-tg-md.js'

function formatValue(value) {
    if (value.length <= 36) return `<code>${escapeHTML(value)}</code>`
    if (value[0] === '{') {
        try {
            value = JSON.stringify(JSON.parse(value), null, 2)
        } catch (e) {

        }
    }
    return `<pre>${escapeHTML(value)}</pre>`
}

export default [
    '/db', '管理 KV Namespace 数据库',
    async (data, ctx, env) => {
        const instr = '/db'
        // 默认参数
        const defaultArgs = { action: 'list', cursor: null, limit: 10, filter: null }
        // 解析回调参数
        const args = typeof data === 'object' ? { ...defaultArgs, ...data } : defaultArgs
        let { action, database, key, value, limit, cursor, filter, confirm } = args
        // 非回调, 手动解析
        if (data && args === defaultArgs) {
            [action, database, key, ...value] = data.split(' ')
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
                    const res = await db.list(ctx.user)

                    if (!res.ok) return Emit(res.result)

                    const databases = res.result
                    if (!(databases?.length > 0))
                        return Emit('<code>0</code> 个数据库被发现.')

                    await Wait('database', 'text', { // 考虑可以手动输入
                        action: 'keys',
                        database: null,
                        cursor: null,
                        filter: null,
                    })
                    return Emit('请选择需要管理的数据库:', databases.map(db => [{
                        text: db.title,
                        callback_data: WaitData('database', db.id)
                    }]))
                }

                case 'keys': {// args: database, cursor?, filter?
                    if (!database) return exec('list')

                    const res = await db.keys(database, ctx.user, limit, cursor, filter)

                    if (!res.ok) return Emit(res.result)

                    const keys = res.result || []
                    const nextCursor = res.result_info?.cursor || null
                    const buttons = keys.map(({ name }) => [{
                        text: name,
                        callback_data: WaitData('key', name)
                    }])

                    // 有下页, 显示下页/筛选按钮
                    if (keys.length === limit) {
                        if (nextCursor) buttons.push([{
                            text: '下页',
                            callback_data: WaitData('action', 'keys')
                        }])
                        buttons.push([{
                            text: '筛选',
                            callback_data: WaitData('action', 'filter')
                        }])
                    }

                    // 添加按钮
                    buttons.push(
                        [{
                            text: '添加',
                            callback_data: WaitData('action', 'add')
                        }]
                    )

                    await Wait('key', 'text', {// 考虑可以手动输入
                        action: 'manage',
                        value: null,
                        confirm: null,
                        cursor: nextCursor,
                    })
                    return Emit(`<b>Database</b>: <code>${database}</code>\n请选择动作或需要管理的数据:`, buttons)
                }

                case 'filter': {// args: database, filter
                    if (!database) return exec('list')

                    await Wait('filter', 'text', {
                        action: 'keys',
                        cursor: null,
                    })

                    return Emit('请输入筛选前缀:', [[{
                        text: '取消',
                        callback_data: WaitData('action', 'keys')
                    }]])
                }

                case 'manage': {// args: database, key
                    if (!database) return exec('list')
                    if (!key) return exec('keys')

                    const res = await db.get(database, key, ctx.user)

                    if (!res.ok) return Emit(res.result)

                    const currentValue = res.result

                    await Wait('action', 'data')
                    return Emit(
                        `<code>Database</code>: <code>${database}</code>\n` +
                        `<code>     Key</code>: <code>${key}</code>\n` +
                        `<code>   Value</code>: ${formatValue(currentValue)}`,
                        [
                            [{ text: '修改', callback_data: WaitData('action', 'mod') }],
                            [{ text: '删除', callback_data: WaitData('action', 'del') }],
                            [{ text: '返回', callback_data: WaitData('action', 'keys') }],
                        ]
                    )
                }

                case 'add': {// args: database, key, value, confirm
                    if (!database) return exec('list')

                    if (!key) {
                        await Wait('key', 'text')
                        return Emit('请输入添加的 key 名称:')
                    }

                    if (value === null || value === undefined) {
                        await Wait('value', 'text')
                        return Emit('请输入添加的 value 值:', [[
                            { text: '置空', callback_data: WaitData('value', '') }
                        ]])
                    }

                    if (!confirm) {
                        await Wait('confirm', 'data')
                        return Emit(
                            `<b>确认添加?</b>\n` +
                            `<code>Database</code>: <code>${database}</code>\n` +
                            `<code>     Key</code>: <code>${key}</code>\n` +
                            `<code>   Value</code>: ${formatValue(value)}`,
                            [[
                                { text: '是', callback_data: WaitData('confirm', true) },
                                { text: '否', callback_data: WaitData('action', 'keys') },
                            ]]
                        )
                    }

                    const res = await db.put(database, key, value, ctx.user)

                    if (!res.ok) return Emit(res.result)

                    await Wait('action', 'data')
                    return Emit('添加成功', [[
                        { text: '返回列表', callback_data: WaitData('action', 'keys') }
                    ]])
                }

                case 'mod': {// args: database, key, value, confirm
                    if (!database) return exec('list')

                    if (!key) return exec('keys')

                    const old = await db.get(database, key, ctx.user)
                    if (!old.ok) return Emit(old.result)

                    if (value === null || value === undefined) {
                        await Wait('value', 'text')
                        return Emit(
                            `<b>当前数据:</b>\n` +
                            `<code>Database</code>: <code>${database}</code>\n` +
                            `<code>     Key</code>: <code>${key}</code>\n` +
                            `<code>   Value</code>: ${formatValue(value)}\n` +
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
                            `<b>确认修改?</b>\n` +
                            `<code>Database</code>: <code>${database}</code>\n` +
                            `<code>     Key</code>: <code>${key}</code>\n` +
                            `<code>OldValue</code>: ${formatValue(old.result)}` +
                            `<code>NewValue</code>: ${formatValue(value)}`,
                            [[
                                { text: '是', callback_data: WaitData('confirm', true) },
                                { text: '否', callback_data: WaitData('action', 'manage') },
                            ]]
                        )
                    }

                    const res = await db.put(database, key, value, ctx.user)
                    if (!res.ok) return Emit(res.result)

                    await Wait('action', 'data')
                    return Emit('修改成功', [[
                        { text: '返回列表', callback_data: WaitData('action', 'keys') }
                    ]])
                }

                case 'del': {// args: database, key, confirm
                    if (!database) return exec('list')
                    if (!key) return exec('keys')

                    if (!confirm) {
                        await Wait('confirm', 'data')
                        return Emit(
                            `<b>确认删除?</b>\n` +
                            `<code>Database</code>: <code>${database}</code>\n` +
                            `<code>     Key</code>: <code>${key}</code>`,
                            [[
                                { text: '是', callback_data: WaitData('confirm', true) },
                                { text: '否', callback_data: WaitData('action', 'manage') },
                            ]]
                        )
                    }

                    const res = await db.del(database, key, ctx.user)
                    if (!res.ok) return Emit(res.result)

                    await Wait('action', 'data')
                    return Emit('删除成功', [[
                        { text: '返回列表', callback_data: WaitData('action', 'keys') }
                    ]])
                }

                default:
                    return Emit(`Unknown action in /db: ${action}`)
            }
        }

        try {
            return exec(action)
        } catch (e) {
            return Emit(`An unexpected error occurred: <pre>${e.message}</pre>`)
        }
    }
]