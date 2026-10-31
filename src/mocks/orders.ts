import { delay, http, HttpResponse } from 'msw'
import type { Cart, NftEvent, Order, OrderEvent, OrderRequest } from '../lib/types'
import { validateCheckout } from '../lib/validate'
import { getDb, saveDb, scenario, type Db, type DbOrder } from './db'

export interface Helpers {
  buildCart: (db: Db, userId: string) => Cart
  userFrom: (req: Request, db: Db) => Promise<{ id: string } | null>
  err: (status: number, code: string, message: string, extra?: object) => Response
  networkGate: () => Promise<Response | null>
  emitNft: (e: NftEvent) => void
  emitOrder: (e: OrderEvent) => void
}
const SETTLE_MS = 2500 // tempo até a "rede" confirmar/recusar o pedido
const pub = ({ userId: _u, outcome: _o, ...o }: DbOrder): Order => o

export const orderHandlers = (h: Helpers) => {
  // Conclui um pedido pendente (idempotente: pedidos terminais nunca mudam).
  function finalize(db: Db, o: DbOrder) {
    if (o.status !== 'pending') return
    const ok = o.outcome === 'confirm'
    o.status = ok ? 'confirmed' : 'rejected'; o.version += 1
    if (ok) {
      o.txHash = `0x${(db.seq + 1).toString(16).padStart(64, '0')}`
      const cart = (db.carts[o.userId] ??= [])
      for (const it of o.items) { // remove do carrinho só o que foi comprado e baixa o estoque
        const nft = db.nfts.find((n) => n.id === it.nftId)
        if (nft) { nft.stock = Math.max(0, nft.stock - it.qty); nft.version += 1; db.seq += 1; h.emitNft({ id: `evt_${db.seq}`, type: 'nft.updated', resource: 'nft', resourceId: nft.id, version: nft.version, data: { priceEth: nft.priceEth, stock: nft.stock } }) }
        const line = cart.find((l) => l.id === it.nftId); if (line) line.qty -= it.qty
      }
      db.carts[o.userId] = cart.filter((l) => l.qty > 0)
    } else o.reason = 'Pagamento recusado pela rede simulada'
    db.seq += 1; saveDb()
    h.emitOrder({ id: `evt_${db.seq}`, type: 'order.updated', resource: 'order', resourceId: o.id, userId: o.userId, version: o.version, data: { status: o.status, txHash: o.txHash, reason: o.reason } })
  }
  const settleIfDue = (db: Db, o: DbOrder) => { if (o.status === 'pending' && Date.now() - o.createdAt >= SETTLE_MS) finalize(db, o) } // recupera após refresh (timer perdido)

  return [
    http.get('/api/wallets', async ({ request }) => {
      const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
      return HttpResponse.json(db.wallets[u.id] ?? [])
    }),
    http.post('/api/wallets/:id/connect', async ({ request, params }) => {
      await delay(400); const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
      const w = db.wallets[u.id]?.find((x) => x.id === params.id); if (!w) return h.err(404, 'NOT_FOUND', 'Carteira não encontrada')
      if (scenario() === 'wallet-refuse') return h.err(403, 'WALLET_REJECTED', 'Conexão recusada pela carteira')
      db.wallets[u.id].forEach((x) => (x.connected = x.id === w.id)); saveDb(); return HttpResponse.json(w)
    }),
    http.post('/api/wallets/:id/disconnect', async ({ request, params }) => {
      const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
      const w = db.wallets[u.id]?.find((x) => x.id === params.id); if (!w) return h.err(404, 'NOT_FOUND', 'Carteira não encontrada')
      w.connected = false; saveDb(); return HttpResponse.json(w)
    }),

    http.post('/api/orders', async ({ request }) => {
      const gate = await h.networkGate(); if (gate) return gate
      const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
      const key = request.headers.get('idempotency-key'); if (!key) return h.err(422, 'VALIDATION', 'Idempotency-Key obrigatória')
      const body = (await request.json()) as OrderRequest; const fp = JSON.stringify(body)
      const prev = db.idempotency[`${u.id}:${key}`]
      if (prev) { // mesma chave: mesmo pedido; conteúdo diferente: conflito
        if (prev.fp !== fp) return h.err(409, 'IDEMPOTENCY_CONFLICT', 'Chave de idempotência reutilizada com conteúdo diferente')
        const existing = db.orders.find((o) => o.id === prev.orderId)!; settleIfDue(db, existing); return HttpResponse.json(pub(existing))
      }
      const { quoteTotal: _q, walletId: _w, ...form } = body
      const errors = validateCheckout(form)
      if (Object.keys(errors).length) return h.err(422, 'VALIDATION', 'Dados inválidos', { fields: errors })
      const wallet = db.wallets[u.id]?.find((w) => w.id === body.walletId)
      if (!wallet) return h.err(404, 'NOT_FOUND', 'Carteira não encontrada')
      if (!wallet.connected) return h.err(409, 'WALLET_NOT_CONNECTED', 'Conecte a carteira antes de comprar')
      // Revalidação: preço, disponibilidade, cupom e taxas vêm da cotação atual (a cotação da API é a referência).
      const cart = h.buildCart(db, u.id)
      if (cart.lines.length === 0) return h.err(422, 'VALIDATION', 'Carrinho vazio')
      if (cart.lines.some((l) => l.qty > l.nft.stock)) return h.err(409, 'STOCK_CONFLICT', 'Um item ficou sem disponibilidade', { cart })
      if (cart.total !== body.quoteTotal) return h.err(409, 'QUOTE_CHANGED', 'Os valores mudaram. Revise e confirme novamente.', { cart })
      db.seq += 1
      const order: DbOrder = {
        id: `ord_${db.seq}`, status: 'pending', version: 1, userId: u.id, outcome: scenario() === 'pay-declined' ? 'decline' : 'confirm',
        items: cart.lines.map((l) => ({ nftId: l.nft.id, name: l.nft.name, image: l.nft.image, priceEth: l.nft.priceEth, qty: l.qty })), // snapshot imutável
        coupon: cart.coupon, subtotal: cart.subtotal, discount: cart.discount, networkFee: cart.networkFee, total: cart.total,
        wallet: { label: form.walletType, address: form.walletAddress }, network: form.network as Order['network'], buyer: { displayName: form.displayName, username: form.username, profileName: form.profileName, email: form.email, referralCode: form.referralCode, ens: form.ens, note: form.note }, txHash: null, reason: null, createdAt: Date.now(),
      }
      db.orders.push(order); db.idempotency[`${u.id}:${key}`] = { fp, orderId: order.id }; saveDb()
      setTimeout(async () => { finalize(await getDb(), order) }, SETTLE_MS)
      if (scenario() === 'order-timeout') await delay(9000) // pedido criado, resposta perdida: o cliente recupera pela mesma chave
      return HttpResponse.json(pub(order), { status: 201 })
    }),
    http.get('/api/orders/pending', async ({ request }) => {
      const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
      const o = db.orders.filter((x) => x.userId === u.id).find((x) => { settleIfDue(db, x); return x.status === 'pending' })
      return HttpResponse.json(o ? pub(o) : null)
    }),
    http.get('/api/orders/:id', async ({ request, params }) => {
      const gate = await h.networkGate(); if (gate) return gate
      const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
      const o = db.orders.find((x) => x.id === params.id); if (!o) return h.err(404, 'NOT_FOUND', 'Pedido não encontrado')
      if (o.userId !== u.id) return h.err(403, 'FORBIDDEN', 'Sem permissão para este pedido')
      settleIfDue(db, o); return HttpResponse.json(pub(o))
    }),
  ]
}
