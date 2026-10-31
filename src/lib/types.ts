import type { CheckoutForm } from './validate'
export interface Nft { id: string; name: string; collection: string; image: string; priceEth: string; stock: number; version: number }
export interface NftPage { items: Nft[]; total: number; page: number; pageSize: number }
export interface User { id: string; name: string; email: string }
export interface CartLine { nft: Nft; qty: number }
export interface Cart { lines: CartLine[]; coupon: string | null; subtotal: string; discount: string; networkFee: string; total: string }
export interface ApiError { code: string; message: string }
export type NftSort = 'price-asc' | 'price-desc' | 'name' | 'newest' | 'trending'
export interface NftEvent { id: string; type: 'nft.updated'; resource: 'nft'; resourceId: string; version: number; data: { priceEth: string; stock: number } }
export interface Wallet { id: string; primary: boolean; connected: boolean; label: string; address: string; network: Network; walletType: string; displayName: string; profileName: string; referralCode: string; email: string; ens: string; secondary: string }
export interface Profile { displayName: string; username: string; email: string; ens: string; nickname: string; avatar: string | null }
export type Network = 'ethereum' | 'polygon' | 'arbitrum'
export interface OrderItem { nftId: string; name: string; image: string; priceEth: string; qty: number }
export type OrderStatus = 'pending' | 'confirmed' | 'rejected'
export interface Order { id: string; status: OrderStatus; version: number; items: OrderItem[]; coupon: string | null; subtotal: string; discount: string; networkFee: string; total: string; wallet: { label: string; address: string }; network: Network; buyer: { displayName: string; username: string; profileName: string; email: string; referralCode: string; ens: string; note: string }; txHash: string | null; reason: string | null; createdAt: number }
export interface OrderRequest extends CheckoutForm { quoteTotal: string; walletId: string }
export interface OrderEvent { id: string; type: 'order.updated'; resource: 'order'; resourceId: string; userId: string; version: number; data: { status: OrderStatus; txHash: string | null; reason: string | null } }
