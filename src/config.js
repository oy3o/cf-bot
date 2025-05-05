export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Bot-Api-Secret-Token',
}

export const DefaultChatContext = {
    //cache: false,
    //messages: [],
    waiting: null,
    //modeltype: 'cohere',
    //model: COHERE_MODEL,
    //temperature: 0.9,
    //stream: false,
}

export const isPublicBOT = true