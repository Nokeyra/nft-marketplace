import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

const Icon = ({ d }: { d: string }) => <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>

// Barra inferior do layout mobile (<640px).
export function BottomNav({ count }: { count: number }) {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const item = (on: boolean) => cn('relative flex flex-col items-center gap-1 px-4 py-1 text-[10px]', on ? 'text-brand' : 'text-muted')
  const badge: ReactNode = count > 0 && <span className="absolute right-2 top-0 grid size-4 place-items-center rounded-full bg-brand text-[9px] font-bold text-ink">{count}</span>
  return (
    <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-30 flex justify-around rounded-t-3xl border-t border-line bg-surface px-2 py-3 sm:hidden">
      <Link to="/" search={{ page: 1 }} className={item(path === '/')}><Icon d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />Início</Link>
      <Link to="/profile/favorites" className={item(path === '/profile/favorites')}><Icon d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z" />Favoritos</Link>
      <Link to="/cart" className={item(path === '/cart')}><Icon d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6" />Carrinho{badge}</Link>
      <Link to="/profile" className={item(path === '/profile' || path === '/profile/wallets')}><Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />Perfil</Link>
    </nav>
  )
}
