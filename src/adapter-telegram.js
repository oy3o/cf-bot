import { escapeHTML } from './lib-tg-md.js'

export async function setWebhook(url, env) {
    if (!env.BOT_SECRET)
        return new Response('BOT_SECRET is not set. Cannot set webhook securely.', { status: 400 })
    return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${encodeURIComponent(url)}&secret_token=${env.BOT_SECRET}`)
}

export async function deleteWebhook(env) {
    return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=`)
}

export async function tgApiRequest(method, data, env) {
    const http = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
        data instanceof FormData ?
            { method: 'POST', body: data } :
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }
    )

    if (!http.ok) return {
        ok: false,
        result: `Telegram API Error for ${method}:\n` +
            ` - Status: ${http.status} ${http.statusText}\n` +
            ` - Body: <pre>${escapeHTML(await http.text())}</pre>`
    }

    const response = await http.json()

    if (!response.ok) return {
        ok: false,
        result: `Telegram API Error for ${method}: ${response.description} (Code: ${response.error_code})`
    }

    return response
}

export async function getMe(env) {
    return tgApiRequest('getMe', {}, env)
}

export async function setMyCommands(commands, env) {
    return tgApiRequest('setMyCommands', { commands }, env)
}

export async function deleteMyCommands(env) {
    return tgApiRequest('deleteMyCommands', {}, env)
}

export async function sendMessage(chat_id, text, env, options = {}) {
    return tgApiRequest('sendMessage', {
        chat_id, text, parse_mode: 'html',
        link_preview_options: { is_disabled: true },
        ...options
    }, env)
}

export async function editMessageText(chat_id, message_id, text, env, options = {}) {
    return tgApiRequest('editMessageText', {
        chat_id, message_id, text, parse_mode: 'html',
        link_preview_options: { is_disabled: true },
        ...options,
    }, env)
}

export async function deleteMessage(chat_id, message_id, env) {
    return tgApiRequest('deleteMessage', { chat_id, message_id }, env)
}

export async function answerCallbackQuery(callback_query_id, text, env, options = {}) {
    return tgApiRequest('answerCallbackQuery', { callback_query_id, text, ...options }, env)
}

export async function banChatMember(chat_id, user_id, env) {
    return tgApiRequest('banChatMember', { chat_id, user_id }, env)
}

const appendOptions = (data, options) => {
    for (const [key, value] of Object.entries(options))
        if (value !== undefined && value !== null)
            data.append(
                key,
                (typeof value === 'string' || value instanceof Blob) ?
                    value :
                    JSON.stringify(value)
            )
}

export async function sendPhoto(chat_id, photo, env, options = {}) {
    let payload = null
    if (typeof photo === 'string') payload = { chat_id, photo, ...options }
    else {
        payload = new FormData()
        payload.append('chat_id', chat_id)
        payload.append('photo', photo, photo.name || 'unname_photo')
        appendOptions(payload, options)
    }
    return tgApiRequest('sendPhoto', payload, env)
}

export async function sendAudio(chat_id, audio, env, options = {}) {
    let payload = null
    if (typeof audio === 'string') {
        payload = { chat_id, audio, ...options }
    } else {
        payload = new FormData()
        payload.append('chat_id', chat_id)
        payload.append('audio', audio, audio.name || 'unnamed_audio')
        appendOptions(payload, options)
    }
    return tgApiRequest('sendAudio', payload, env)
}

export async function sendDocument(chat_id, document, env, options = {}) {
    let payload = null
    if (typeof document === 'string') {
        payload = { chat_id, document, ...options }
    } else {
        payload = new FormData()
        payload.append('chat_id', chat_id)
        payload.append('document', document, document.name || 'unnamed_document')
        appendOptions(payload, options)
    }
    return tgApiRequest('sendDocument', payload, env)
}

export async function sendVideo(chat_id, video, env, options = {}) {
    let payload = null
    if (typeof video === 'string') {
        payload = { chat_id, video, ...options }
    } else {
        payload = new FormData()
        payload.append('chat_id', chat_id)
        payload.append('video', video, video.name || 'unnamed_video')
        appendOptions(payload, options)
    }
    return tgApiRequest('sendVideo', payload, env)
}

export async function sendVoice(chat_id, voice, env, options = {}) {
    let payload = null
    if (typeof voice === 'string') {
        payload = { chat_id, voice, ...options }
    } else {
        payload = new FormData()
        payload.append('chat_id', chat_id)
        payload.append('voice', voice, voice.name || 'unnamed_voice.ogg')
        appendOptions(payload, options)
    }
    return tgApiRequest('sendVoice', payload, env)
}
