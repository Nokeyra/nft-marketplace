import { HttpResponse, http } from 'msw'
import { validateProfile, validateWallet, type WalletForm } from '../lib/validate'
import type { Profile, Wallet } from '../lib/types'
import { getDb, saveDb, scenario, sha256 } from './db'
import type { Helpers } from './orders'

export const accountHandlers = (h: Helpers) => [
  http.post('/api/auth/register', async ({ request }) => {
    const gate = await h.networkGate(); if (gate) return gate
    const { name, email, password } = (await request.json()) as { name: string; email: string; password: string }
    const fields: Record<string, string> = {}
    if (!name || name.trim().length < 3) fields.name = 'Informe o nome completo'
    if (!/^\S+@\S+\.\S+$/.test(email ?? '')) fields.email = 'E-mail inválido'
    if (!password || password.length < 8) fields.password = 'A senha precisa ter ao menos 8 caracteres'
    if (Object.keys(fields).length) return h.err(422, 'VALIDATION', 'Dados inválidos', { fields })
    const db = await getDb()
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return h.err(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado', { fields: { email: 'Este e-mail já está cadastrado' } })
    const user = { id: `u${db.users.length + 1}`, name: name.trim(), email, pwHash: await sha256(password) } // senha nunca em claro
    db.users.push(user); db.wallets[user.id] = []
    db.profiles[user.id] = { displayName: user.name, username: user.name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || `user${db.users.length}`, email: user.email, ens: '', nickname: '', avatar: null }
    const token = `tok_${user.id}_${Date.now()}`; db.sessions[token] = user.id; saveDb()
    return HttpResponse.json({ token, user: { id: user.id, name: user.name, email: user.email } }, { status: 201 })
  }),

  http.get('/api/favorites', async ({ request }) => {
    const gate = await h.networkGate(); if (gate) return gate
    const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
    return HttpResponse.json(db.favorites[u.id] ?? [])
  }),
  http.put('/api/favorites/:id', async ({ request, params }) => {
    const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
    if (scenario() === 'favorite-fail') return h.err(500, 'TRANSIENT', 'Falha transitória')
    if (!db.nfts.some((n) => n.id === params.id)) return h.err(404, 'NOT_FOUND', 'NFT não encontrado')
    db.favorites[u.id] = [...new Set([...(db.favorites[u.id] ?? []), String(params.id)])]; saveDb()
    return HttpResponse.json(db.favorites[u.id])
  }),
  http.delete('/api/favorites/:id', async ({ request, params }) => {
    const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
    if (scenario() === 'favorite-fail') return h.err(500, 'TRANSIENT', 'Falha transitória')
    db.favorites[u.id] = (db.favorites[u.id] ?? []).filter((x) => x !== params.id); saveDb()
    return HttpResponse.json(db.favorites[u.id])
  }),

  http.get('/api/profile', async ({ request }) => {
    const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
    return HttpResponse.json(db.profiles[u.id])
  }),
  http.put('/api/profile', async ({ request }) => {
    const gate = await h.networkGate(); if (gate) return gate
    const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
    const b = (await request.json()) as Profile & { currentPassword?: string; newPassword?: string }
    const errors = validateProfile(b, { current: b.currentPassword ?? '', next: b.newPassword ?? '', confirm: b.newPassword ?? '' })
    if (b.avatar && (!b.avatar.startsWith('data:image/') || b.avatar.length > 300_000)) errors.avatar = 'Imagem inválida ou grande demais'
    const user = db.users.find((x) => x.id === u.id)!
    if (b.newPassword && !errors.currentPassword && user.pwHash !== (await sha256(b.currentPassword ?? ''))) errors.currentPassword = 'Senha atual incorreta'
    if (Object.keys(errors).length) return h.err(422, 'VALIDATION', 'Dados inválidos', { fields: errors })
    if (Object.entries(db.profiles).some(([id, p]) => id !== u.id && p.username.toLowerCase() === b.username.toLowerCase())) return h.err(409, 'USERNAME_TAKEN', 'Nome de usuário já em uso', { fields: { username: 'Nome de usuário já em uso' } })
    if (db.users.some((x) => x.id !== u.id && x.email.toLowerCase() === b.email.toLowerCase())) return h.err(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado', { fields: { email: 'Este e-mail já está cadastrado' } })
    db.profiles[u.id] = { displayName: b.displayName.trim(), username: b.username, email: b.email, ens: b.ens, nickname: b.nickname.trim(), avatar: b.avatar ?? null }
    user.name = b.displayName.trim(); user.email = b.email
    if (b.newPassword) user.pwHash = await sha256(b.newPassword)
    saveDb(); return HttpResponse.json(db.profiles[u.id])
  }),

  // Carteiras cadastradas: uma principal e no máximo uma secundária.
  http.post('/api/wallets', async ({ request }) => {
    const gate = await h.networkGate(); if (gate) return gate
    const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
    const { primary, ...f } = (await request.json()) as WalletForm & { primary: boolean }
    const errors = validateWallet(f); if (Object.keys(errors).length) return h.err(422, 'VALIDATION', 'Dados inválidos', { fields: errors })
    const list = (db.wallets[u.id] ??= [])
    if (list.some((w) => w.primary) === primary || (!primary && list.length >= 2)) return h.err(409, 'WALLET_LIMIT', primary ? 'Você já tem uma carteira principal' : 'Você já tem uma carteira secundária')
    if (list.some((w) => w.address.toLowerCase() === f.walletAddress.toLowerCase())) return h.err(409, 'WALLET_DUPLICATE', 'Carteira já cadastrada', { fields: { walletAddress: 'Esta carteira já está cadastrada' } })
    db.seq += 1
    const w: Wallet = { id: `w${Date.now()}${db.seq}`, primary, connected: false, label: f.nickname.trim(), address: f.walletAddress, network: f.network as Wallet['network'], walletType: f.walletType, displayName: f.displayName.trim(), profileName: f.profileName.trim(), referralCode: f.referralCode, email: f.email, ens: f.ens, secondary: f.secondary }
    list.push(w); saveDb(); return HttpResponse.json(w, { status: 201 })
  }),
  http.put('/api/wallets/:id', async ({ request, params }) => {
    const gate = await h.networkGate(); if (gate) return gate
    const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
    const w = db.wallets[u.id]?.find((x) => x.id === params.id); if (!w) return h.err(404, 'NOT_FOUND', 'Carteira não encontrada')
    const f = (await request.json()) as WalletForm
    const errors = validateWallet(f); if (Object.keys(errors).length) return h.err(422, 'VALIDATION', 'Dados inválidos', { fields: errors })
    if (db.wallets[u.id].some((x) => x.id !== w.id && x.address.toLowerCase() === f.walletAddress.toLowerCase())) return h.err(409, 'WALLET_DUPLICATE', 'Carteira já cadastrada', { fields: { walletAddress: 'Esta carteira já está cadastrada' } })
    if (w.address !== f.walletAddress) w.connected = false // endereço novo exige nova conexão
    Object.assign(w, { label: f.nickname.trim(), address: f.walletAddress, network: f.network, walletType: f.walletType, displayName: f.displayName.trim(), profileName: f.profileName.trim(), referralCode: f.referralCode, email: f.email, ens: f.ens, secondary: f.secondary })
    saveDb(); return HttpResponse.json(w)
  }),
  http.delete('/api/wallets/:id', async ({ request, params }) => {
    const db = await getDb(); const u = await h.userFrom(request, db); if (!u) return h.err(401, 'SESSION_INVALID', 'Sessão inválida')
    const w = db.wallets[u.id]?.find((x) => x.id === params.id); if (!w) return h.err(404, 'NOT_FOUND', 'Carteira não encontrada')
    if (w.primary) return h.err(409, 'WALLET_PRIMARY', 'A carteira principal não pode ser removida')
    db.wallets[u.id] = db.wallets[u.id].filter((x) => x.id !== w.id); saveDb(); return new HttpResponse(null, { status: 204 })
  }),
]
