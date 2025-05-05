import * as cf from './adapter-cloudflare.js'

export const list = cf.getKvNamespaces
export const keys = cf.getKvNamespaceKeys
export const get = cf.getKvNamespaceValue
export const put = cf.putKvNamespaceValue
export const del = cf.delKvNamespaceValue


export const getUser = async (userid, env) => env.data.get(userid)
export const putUser = async (userid, user, env) => env.data.put(userid, JSON.stringify(user))
