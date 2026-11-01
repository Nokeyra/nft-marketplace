import { APES } from '../lib/images'
import type { Nft, Order, Profile, Wallet } from '../lib/types'

// Banco simulado em memória, persistido em localStorage para sobreviver a refresh.
// resetDb() restaura integralmente o cenário conhecido (seed determinístico).
const KEY = 'mock-db-v4'
export interface MockUser { id: string; name: string; email: string; pwHash: string }
export interface Db { nfts: Nft[]; users: MockUser[]; carts: Record<string, { id: string; qty: number }[]>; coupons: Record<string, string>; sessions: Record<string, string>; seq: number; wallets: Record<string, Wallet[]>; orders: DbOrder[]; favorites: Record<string, string[]>; profiles: Record<string, Profile & { avatar: string | null }>; idempotency: Record<string, { fp: string; orderId: string }> }
export type DbOrder = Order & { userId: string; outcome: 'confirm' | 'decline' }

export const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')

const COLLECTIONS = ['Cosmic Drift', 'Pixel Pets', 'Neon Skies', 'Abstract Minds']
const seedNfts = (): Nft[] =>
  Array.from({ length: 36 }, (_, i) => ({
    id: String(i + 1), name: `${COLLECTIONS[i % 4]} #${100 + i}`, collection: COLLECTIONS[i % 4],
    image: APES[(i + Math.floor(i / 4)) % APES.length],
    priceEth: `${Math.floor(((i * 37) % 90) / 10)}.${String(((i * 37) % 90) + 10).padStart(2, '0')}`,
    stock: i % 7 === 0 ? 0 : (i % 5) + 1, version: 1,
  }))

export async function seed(): Promise<Db> {
  const pw = await sha256('demo1234')
  return {
    nfts: seedNfts(), seq: 0, carts: {}, sessions: {}, orders: [], idempotency: {}, favorites: {},
    profiles: {
      u1: { displayName: 'Ana Colecionadora', username: 'ana', email: 'ana@demo.dev', ens: 'ana-colecionadora', nickname: 'Carteira da Ana', avatar: null },
      u2: { displayName: 'Bruno Colecionador', username: 'bruno', email: 'bruno@demo.dev', ens: 'bruno-colecionador', nickname: 'Carteira do Bruno', avatar: null },
    },
    wallets: {
      u1: [
        { id: 'w1', label: 'Carteira principal', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', primary: true, connected: false, network: 'ethereum', walletType: 'MetaMask', displayName: 'Ana Colecionadora', profileName: 'Ana Colecionadora', referralCode: 'KURIO2026', email: 'ana@demo.dev', ens: 'ana-colecionadora', secondary: '' },
        { id: 'w2', label: 'Carteira secundária', address: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', primary: false, connected: false, network: 'polygon', walletType: 'WalletConnect', displayName: 'Ana Colecionadora', profileName: 'Ana Colecionadora', referralCode: 'KURIO2026', email: 'ana@demo.dev', ens: 'ana-colecionadora', secondary: '' },
      ],
      u2: [{ id: 'w3', label: 'Carteira principal', address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30', primary: true, connected: false, network: 'ethereum', walletType: 'Coinbase Wallet', displayName: 'Bruno Colecionador', profileName: 'Bruno Colecionador', referralCode: 'KURIO2026', email: 'bruno@demo.dev', ens: 'bruno-colecionador', secondary: '' }],
    },
    users: [{ id: 'u1', name: 'Ana Colecionadora', email: 'ana@demo.dev', pwHash: pw }, { id: 'u2', name: 'Bruno Colecionador', email: 'bruno@demo.dev', pwHash: pw }],
    coupons: { JUNGLE10: 'ok', OLD2020: 'expired' },
  }
}

let db: Db | null = null
export async function getDb(): Promise<Db> {
  if (db) return db
  const raw = localStorage.getItem(KEY)
  db = raw ? (JSON.parse(raw) as Db) : await seed()
  return db
}
export const saveDb = () => db && localStorage.setItem(KEY, JSON.stringify(db))
export async function resetDb() { db = await seed(); saveDb() }
export const scenario = () => localStorage.getItem('mock-scenario') ?? 'default'
