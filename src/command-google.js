// in ./command-google.js

import * as bot from './adapter-telegram.js';

export default [
    '/google', '管理您的 Google 凭证',
    async (data, ctx, env) => {
        const instr = '/google';
        
        // 1. 设置默认参数和解析逻辑
        const defaultArgs = { action: 'token' }; // 默认动作是 'token'
        const args = typeof data === 'object' ? { ...defaultArgs, ...data } : defaultArgs;
        let { action } = args;

        // 如果是直接输入命令，解析第一个单词作为 action
        if (data && args === defaultArgs) {
            [action] = data.split(' ');
        }
        
        // 辅助函数，用于生成回调数据
        const WaitAction = (action) => '!' + JSON.stringify(([0, instr, action])).slice(1, -1);
        const WaitData = (name, value) => '!' + JSON.stringify(([1, instr, name, value])).slice(1, -1);
        
        // 统一的消息发送函数
        async function Emit(text, buttons = []) {
            const withButtons = buttons.length ? { reply_markup: { inline_keyboard: buttons.concat([[{ text: '关闭', callback_data: WaitAction('close') }]]) } } : {};
            return ctx.isbot ?
                bot.editMessageText(ctx.chatid, ctx.messageid, text, env, withButtons) :
                bot.sendMessage(ctx.chatid, text, env, withButtons);
        }

        const exec = async (action) => {
            switch (action) {
                case 'token': {
                    // 2. 检查用户是否已登录 (即 user 对象中是否有 google_auth)
                    const tokens = ctx.user.google_auth;
                    if (!tokens || !tokens.access_token) {
                        // 如果未登录，直接执行 login 动作
                        return exec('login');
                    }

                    // 如果已登录，格式化并显示凭证信息
                    const formattedTokens = {
                        ...tokens,
                        access_token: tokens.access_token.substring(0, 15) + '...',
                        refresh_token: tokens.refresh_token ? tokens.refresh_token.substring(0, 15) + '...' : 'N/A',
                        id_token: tokens.id_token ? tokens.id_token.substring(0, 15) + '...' : 'N/A',
                        expiry_date_human: new Date(tokens.expiry_date).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
                    };
                    
                    const tokenText = '<b>您的 Google 凭证信息:</b>\n' +
                                      `<pre>${JSON.stringify(formattedTokens, null, 2)}</pre>`;

                    return Emit(tokenText, [
                        // 提供一个重新登录的按钮
                        [{ text: '重新登录', callback_data: WaitData('action', 'login') }]
                    ]);
                }

                case 'login': {
                    // 3. 登录动作，始终返回带 URL 的登录按钮
                    const G_CLIENT_ID = env.GOOGLE_CLIENT_ID;
                    if (!G_CLIENT_ID) {
                        return Emit('管理员未配置 Google Client ID，无法登录。');
                    }
                    const REDIRECT_URI = `https://${env.CF_WORKER_ENDPOINT}/google-oauth-callback`;
                    const state = ctx.userid;
                    const scope = 'https://www.googleapis.com/auth/cloud-platform';
        
                    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                        `client_id=${encodeURIComponent(G_CLIENT_ID)}` +
                        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
                        `&response_type=code` +
                        `&scope=${encodeURIComponent(scope)}` +
                        `&state=${encodeURIComponent(state)}` +
                        `&access_type=offline` +
                        `&prompt=consent`;
            
                    const text = '请点击下面的按钮登录您的 Google 账户以授权机器人:';
                    const buttons = [[{
                        text: '🔗 通过 Google 登录',
                        url: authUrl
                    }]];
            
                    return bot.sendMessage(ctx.chatid, text, env, {
                        reply_markup: {
                            inline_keyboard: buttons
                        }
                    });
                }
                
                default:
                    return Emit(`未知的 /google 命令动作: ${action}`);
            }
        };
        
        try {
            return exec(action);
        } catch (e) {
            return Emit(`执行 /google 命令时发生错误: <pre>${e.message}</pre>`);
        }
    }
];