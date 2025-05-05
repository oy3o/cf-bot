import { escapeHTML } from './lib-tg-md.js'

export async function cfApiRequest(method, path, env, data, headers = {}) {
    const http = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/${path}`, {
        method,
        headers: {
            'Authorization': `Bearer ${env.CF_API_TOKEN}`,
            ...(data?.constructor === Object ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
        },
        body: data ? (typeof data === 'string' ? data : data instanceof FormData ? data : JSON.stringify(data)) : null,
    })

    if (!http.ok) return {
        ok: false,
        result: `Cloudflare API Error for ${method} ${path}:\n` +
            ` - Status: ${http.status} ${http.statusText}\n` +
            ` - Body: <pre>${escapeHTML(await http.text())}</pre>`
    }

    if (http.status === 204 ||
        http.headers.get('content-length') === '0'
    ) return { ok: true, result: null }

    return http.headers.get('content-type')?.includes('application/json') ?
        { ok: true, ...(await http.json()) } :
        { ok: true, result: await http.text() }
}

export async function getWorkers(env) {
    return cfApiRequest('GET', 'workers/scripts', env)
}

export async function getWorkerBindings(workerID, env) {
    return cfApiRequest('GET', `workers/scripts/${workerID}/settings`, env)
}

export async function putWorkerBindings(workerID, bindings, env) {
    const data = new FormData()
    data.append('settings', JSON.stringify({ bindings }))
    return cfApiRequest('PATCH', `workers/scripts/${workerID}/settings`, env, data)
}

export async function putWorkerSecret(workerID, secret, env) {
    return cfApiRequest('PUT', `workers/scripts/${workerID}/secrets`, env, secret)
}

export async function deltWorkerSecret(workerID, name, env) {
    return cfApiRequest('DELETE', `workers/scripts/${workerID}/secrets/${encodeURIComponent(name)}`, env)
}

export async function getKvNamespaces(env) {
    return cfApiRequest('GET', 'storage/kv/namespaces', env)
}

export async function getKvNamespaceKeys(namespaceId, env, limit = 10, cursor = null, prefix = null) {
    return cfApiRequest('GET', `storage/kv/namespaces/${namespaceId}/keys?limit=${limit}${cursor ? '&cursor=' + cursor : ''}${prefix ? '&prefix=' + prefix : ''}`, env)
}

export async function getKvNamespaceValue(namespaceId, key, env) {
    return cfApiRequest('GET', `storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`, env)
}

export async function putKvNamespaceValue(namespaceId, key, value, env) {
    return cfApiRequest('PUT', `storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`, env, value)
}

export async function delKvNamespaceValue(namespaceId, key, env) {
    return cfApiRequest('DELETE', `storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`, env)
}
