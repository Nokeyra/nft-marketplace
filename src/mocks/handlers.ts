import { delay, http, HttpResponse, ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { bps, fromWei, toWei } from '../lib/eth'
import type { Cart, NftEvent, OrderEvent } from '../lib/types'
import { accountHandlers } from './accounts'
import { orderHandlers } from './orders'
import { getDb, resetDb, saveDb, scenario, sha256, type Db } from './db'

const err = (status: number, code: string, message: string, extra: object = {}) => HttpResponse.json({ code, message, ...extra }, { status })

// Cenários configuráveis (localStorage['mock-scenario'] ou ?scenario= na URL). Todos determinísticos:
// slow, jitter (padrão fixo de latências, gera respostas fora de ordem), timeout, error (503), error-4xx (429),
// offline, session-expired, empty, pay-declined, order-timeout, wallet-refuse, favorite-fail.
const JITTER_MS = [1200, 150, 800, 300, 1500, 100]
let tick = 0
async function networkGate() {
  const s = scenario()
  if (s === 'slow') await delay(2500)
  else if (s === 'jitter') await delay(JITTER_MS[tick++ % JITTER_MS.length])
  else if (s === 'timeout') await delay(9000) // maior que o timeout do Axios (8s)
  else await delay(150)
  if (s === 'error') return err(503, 'TRANSIENT', 'Serviço indisponível')
  if (s === 'error-4xx') return err(429, 'RATE_LIMITED', 'Muitas requisições. Tente novamente em instantes.')
  if (s === 'offline') return HttpResponse.error()
  return null
}
async function userFrom(req: Request, db: Db) {
  if (scenario() === 'session-expired') return null // todo acesso autenticado passa a responder 401
  const t = req.headers.get('authorization')?.replace('Bearer ', '')
  const id = t ? db.sessions[t] : undefined
  return db.users.find((u) => u.id === id) ?? null
}

function buildCart(db: Db, userId: string): Cart {
  const lines = (db.carts[userId] ?? []).flatMap((l) => { const nft = db.nfts.find((n) => n.id === l.id); return nft ? [{ nft, qty: l.qty }] : [] })
  const subtotal = lines.reduce((a, l) => a + toWei(l.nft.priceEth) * BigInt(l.qty), 0n)
  const coupon = db.coupons[`active:${userId}`] ?? null
  const discount = coupon ? bps(subtotal, 1000n) : 0n
  const fee = bps(subtotal - discount, 50n)
  return { lines, coupon, subtotal: fromWei(subtotal), discount: fromWei(discount), networkFee: fromWei(fee), total: fromWei(subtotal - discount + fee) }
}

// Socket.IO simulado na camada de rede (WebSocket interceptado pelo MSW + @mswjs/socket.io-binding).
const sockets = new Set<ReturnType<typeof toSocketIo>>()
const realtime = ws.link('*/socket.io/')
function emitNft(e: NftEvent) { sockets.forEach((io) => io.client.emit('nft.updated', e)) }
function emitOrder(e: OrderEvent) { sockets.forEach((io) => io.client.emit('order.updated', e)) }

export const handlers = [
  ...orderHandlers({ buildCart, userFrom, err, networkGate, emitNft, emitOrder }),
  ...accountHandlers({ buildCart, userFrom, err, networkGate, emitNft, emitOrder }),
  realtime.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    sockets.add(io)
    connection.client.addEventListener('close', () => sockets.delete(io))
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const gate = await networkGate(); if (gate) return gate
    const { email, password } = (await request.json()) as { email: string; password: string }
    const db = await getDb()
    const u = db.users.find((x) => x.email === email)
    if (!u || u.pwHash !== (await sha256(password))) return err(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos')
    const token = `tok_${u.id}_${Date.now()}`
    db.sessions[token] = u.id; saveDb()
    return HttpResponse.json({ token, user: { id: u.id, name: u.name, email: u.email } })
  }),
  http.get('/api/auth/session', async ({ request }) => {
    const db = await getDb(); const u = await userFrom(request, db)
    return u ? HttpResponse.json({ id: u.id, name: u.name, email: u.email }) : err(401, 'SESSION_INVALID', 'Sessão inválida ou expirada')
  }),
  http.post('/api/auth/logout', async ({ request }) => {
    const db = await getDb(); const t = request.headers.get('authorization')?.replace('Bearer ', '')
    if (t) delete db.sessions[t]; saveDb(); return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/nfts', async ({ request }) => {
    const gate = await networkGate(); if (gate) return gate
    const url = new URL(request.url); const db = await getDb()
    const q = url.searchParams.get('q')?.toLowerCase() ?? ''; const col = url.searchParams.get('collection')
    const sort = url.searchParams.get('sort'); const page = Number(url.searchParams.get('page') ?? 1); const pageSize = Math.min(24, Number(url.searchParams.get('pageSize') ?? 9) || 9)
    const min = url.searchParams.get('minPrice'); const max = url.searchParams.get('maxPrice')
    let items = scenario() === 'empty' ? [] : db.nfts.filter((n) => (!q || n.name.toLowerCase().includes(q)) && (!col || n.collection === col) && (!min || toWei(n.priceEth) >= toWei(min)) && (!max || toWei(n.priceEth) <= toWei(max)))
    if (sort === 'price-asc') items = [...items].sort((a, b) => Number(toWei(a.priceEth) - toWei(b.priceEth)))
    if (sort === 'price-desc') items = [...items].sort((a, b) => Number(toWei(b.priceEth) - toWei(a.priceEth)))
    if (sort === 'newest') items = [...items].sort((a, b) => Number(b.id) - Number(a.id))
    if (sort === 'trending') items = [...items].sort((a, b) => a.stock - b.stock || Number(a.id) - Number(b.id))
    if (sort === 'name') items = [...items].sort((a, b) => a.name.localeCompare(b.name))
    return HttpResponse.json({ items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize })
  }),
  http.get('/api/nfts/:id', async ({ params }) => {
    const gate = await networkGate(); if (gate) return gate
    const n = (await getDb()).nfts.find((x) => x.id === params.id)
    return n ? HttpResponse.json(n) : err(404, 'NOT_FOUND', 'NFT não encontrado')
  }),

  http.get('/api/cart', async ({ request }) => {
    const gate = await networkGate(); if (gate) return gate
    const db = await getDb(); const u = await userFrom(request, db)
    return u ? HttpResponse.json(buildCart(db, u.id)) : err(401, 'SESSION_INVALID', 'Sessão inválida')
  }),
  http.put('/api/cart/items/:id', async ({ request, params }) => {
    const gate = await networkGate(); if (gate) return gate
    const db = await getDb(); const u = await userFrom(request, db); if (!u) return err(401, 'SESSION_INVALID', 'Sessão inválida')
    const nft = db.nfts.find((n) => n.id === params.id); if (!nft) return err(404, 'NOT_FOUND', 'NFT não encontrado')
    const { qty } = (await request.json()) as { qty: number }
    if (!Number.isInteger(qty) || qty < 1) return err(422, 'VALIDATION', 'Quantidade inválida')
    if (qty > nft.stock) return err(409, 'STOCK_CONFLICT', `Apenas ${nft.stock} disponível(is)`)
    const cart = (db.carts[u.id] ??= []); const l = cart.find((x) => x.id === nft.id)
    if (l) l.qty = qty
    else cart.push({ id: nft.id, qty })
    saveDb()
    return HttpResponse.json(buildCart(db, u.id))
  }),
  http.delete('/api/cart/items/:id', async ({ request, params }) => {
    const db = await getDb(); const u = await userFrom(request, db); if (!u) return err(401, 'SESSION_INVALID', 'Sessão inválida')
    db.carts[u.id] = (db.carts[u.id] ?? []).filter((l) => l.id !== params.id); saveDb()
    return HttpResponse.json(buildCart(db, u.id))
  }),
  http.put('/api/cart/coupon', async ({ request }) => {
    const db = await getDb(); const u = await userFrom(request, db); if (!u) return err(401, 'SESSION_INVALID', 'Sessão inválida')
    const { code } = (await request.json()) as { code: string }; const kind = db.coupons[code.toUpperCase()]
    if (kind === 'expired') return err(410, 'COUPON_EXPIRED', 'Cupom expirado')
    if (!kind) return err(422, 'COUPON_INVALID', 'Cupom inválido')
    db.coupons[`active:${u.id}`] = code.toUpperCase(); saveDb()
    return HttpResponse.json(buildCart(db, u.id))
  }),

  // Controles de demonstração/testes: mudam o estado simulado E emitem o evento correspondente via Socket.IO.
  http.post('/api/__mock/nft/:id', async ({ request, params }) => {
    const db = await getDb(); const n = db.nfts.find((x) => x.id === params.id); if (!n) return err(404, 'NOT_FOUND', 'NFT não encontrado')
    const body = (await request.json()) as { priceEth?: string; stock?: number; duplicate?: boolean }
    if (body.priceEth) n.priceEth = body.priceEth
    if (body.stock !== undefined) n.stock = body.stock
    n.version += 1; db.seq += 1; saveDb()
    const ev: NftEvent = { id: `evt_${db.seq}`, type: 'nft.updated', resource: 'nft', resourceId: n.id, version: n.version, data: { priceEth: n.priceEth, stock: n.stock } }
    emitNft(ev); if (body.duplicate) emitNft(ev)
    return HttpResponse.json(ev)
  }),
  http.post('/api/__mock/reset', async () => { tick = 0; await resetDb(); return new HttpResponse(null, { status: 204 }) }),
]
