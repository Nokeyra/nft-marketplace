import axios from 'axios'
import type { Cart, Nft, NftPage, NftSort, Order, OrderRequest, Profile, User, Wallet } from './types'
import type { WalletForm } from './validate'

export const TOKEN_KEY = 'session-token'
export const http = axios.create({ baseURL: '/api', timeout: 8000 })
http.interceptors.request.use((c) => {
  const t = localStorage.getItem(TOKEN_KEY)
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})
http.interceptors.response.use(undefined, (err) => {
  if (axios.isAxiosError(err) && err.response?.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(new Event('session-expired'))
  }
  return Promise.reject(err)
})

export interface NftParams { q?: string; collection?: string; sort?: NftSort; minPrice?: string; maxPrice?: string; pageSize?: number; page: number }
export const api = {
  register: (v: { name: string; email: string; password: string }) => http.post<{ token: string; user: User }>('/auth/register', v).then((r) => r.data),
  favorites: () => http.get<string[]>('/favorites').then((r) => r.data),
  addFavorite: (id: string) => http.put<string[]>(`/favorites/${id}`).then((r) => r.data),
  removeFavorite: (id: string) => http.delete<string[]>(`/favorites/${id}`).then((r) => r.data),
  login: (email: string, password: string) => http.post<{ token: string; user: User }>('/auth/login', { email, password }).then((r) => r.data),
  session: () => http.get<User>('/auth/session').then((r) => r.data),
  logout: () => http.post('/auth/logout'),
  nfts: (p: NftParams, signal?: AbortSignal) => http.get<NftPage>('/nfts', { params: p, signal }).then((r) => r.data),
  nft: (id: string, signal?: AbortSignal) => http.get<Nft>(`/nfts/${id}`, { signal }).then((r) => r.data),
  cart: () => http.get<Cart>('/cart').then((r) => r.data),
  setQty: (nftId: string, qty: number) => http.put<Cart>(`/cart/items/${nftId}`, { qty }).then((r) => r.data),
  removeItem: (nftId: string) => http.delete<Cart>(`/cart/items/${nftId}`).then((r) => r.data),
  wallets: () => http.get<Wallet[]>('/wallets').then((r) => r.data),
  profile: () => http.get<Profile>('/profile').then((r) => r.data),
  saveProfile: (v: Profile & { currentPassword?: string; newPassword?: string }) => http.put<Profile>('/profile', v).then((r) => r.data),
  createWallet: (v: WalletForm & { primary: boolean }) => http.post<Wallet>('/wallets', v).then((r) => r.data),
  updateWallet: (id: string, v: WalletForm) => http.put<Wallet>(`/wallets/${id}`, v).then((r) => r.data),
  deleteWallet: (id: string) => http.delete(`/wallets/${id}`),
  connectWallet: (id: string) => http.post<Wallet>(`/wallets/${id}/connect`).then((r) => r.data),
  disconnectWallet: (id: string) => http.post<Wallet>(`/wallets/${id}/disconnect`).then((r) => r.data),
  createOrder: (key: string, body: OrderRequest) => http.post<Order>('/orders', body, { headers: { 'Idempotency-Key': key } }).then((r) => r.data),
  order: (id: string) => http.get<Order>(`/orders/${id}`).then((r) => r.data),
  pendingOrder: () => http.get<Order | null>('/orders/pending').then((r) => r.data),
  applyCoupon: (code: string) => http.put<Cart>('/cart/coupon', { code }).then((r) => r.data),
}

export const sessionQuery = { queryKey: ['session'], queryFn: api.session, retry: false, staleTime: 60_000 } as const
export const errorBody = (e: unknown) => (axios.isAxiosError(e) ? (e.response?.data as { code?: string; message?: string; cart?: Cart; fields?: Record<string, string> } | undefined) : undefined)
export const errorMessage = (e: unknown) => (axios.isAxiosError(e) && e.code === 'ECONNABORTED' ? 'Tempo esgotado.' : errorBody(e)?.message ?? 'Falha de conexão')
