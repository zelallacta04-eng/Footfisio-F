interface Env {
  NOCODB_API_TOKEN: string
  NOCODB_UPSTREAM_URL?: string
  NOCODB_BASE_ID?: string // opcional: si se define, solo se permite esa base
}

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

export const onRequest = async ({ request, env }: { request: Request; params: { path?: string | string[] }; env: Env }) => {
  if (!env.NOCODB_API_TOKEN) return json(503, 'Falta configurar el secreto NOCODB_API_TOKEN en Cloudflare Pages.')
  const upstream = (env.NOCODB_UPSTREAM_URL || 'https://app.nocodb.com').replace(/\/$/, '')
  const incoming = new URL(request.url)
  const suffix = incoming.pathname.replace(/^\/api\/nocodb\/?/, '')

  // Lista blanca: solo datos de registros (y lectura de tablas de la base). Nada más del API de NocoDB.
  const esDatos = /^api\/v3\/data\/[^/]+\/[^/]+\//.test(suffix)
  const esEsquema = request.method === 'GET' && /^api\/v3\/meta\/bases\/[^/]+\/tables\/?$/.test(suffix)
  if (suffix.includes('..') || !(esDatos || esEsquema)) return json(403, 'Ruta no permitida.')
  if (env.NOCODB_BASE_ID && !suffix.split('/').includes(env.NOCODB_BASE_ID)) return json(403, 'Base no permitida.')

  const headers = new Headers(request.headers)
  headers.set('xc-token', env.NOCODB_API_TOKEN)
  headers.delete('host')
  headers.delete('content-length')
  const init: RequestInit = { method: request.method, headers, redirect: 'follow' }
  if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body
  const response = await fetch(`${upstream}/${suffix}${incoming.search}`, init)
  const out = new Headers(response.headers)
  out.delete('content-encoding')
  out.delete('content-length')
  out.set('cache-control', 'no-store')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: out })
}
