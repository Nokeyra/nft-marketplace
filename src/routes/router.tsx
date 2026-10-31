import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, createRoute, createRouter, Link, Outlet, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import axios from 'axios'
import { NftCard, NftCardSkeleton } from '../components/nft-card'
import { AuthCard, PasswordField } from '../components/auth'
import { Field } from '../components/field'
import { BackButton } from '../components/back-button'
import { BottomNav } from '../components/bottom-nav'
import { Footer } from '../components/footer'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'
import { fromWei, toWei } from '../lib/eth'
import { APES } from '../lib/images'
import { Skeleton } from '../components/ui/skeleton'
import { api, TOKEN_KEY } from '../lib/api'
import { useRealtime } from '../lib/realtime'
import type { Cart, NftSort } from '../lib/types'
import { CheckoutPage, OrderPage } from './checkout'
import { FavoritesPage, ProfileData, ProfileShell, WalletsPage } from './profile'
import { RegisterPage } from './register'

interface Ctx { qc: QueryClient }
const msg = (e: unknown) => (axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message ?? 'Falha de conexão' : 'Erro inesperado')
const sessionQ = { queryKey: ['session'], queryFn: api.session, retry: false, staleTime: 60_000 }

function Root() {
  const qc = useQueryClient(); const nav = useNavigate()
  const path = useRouterState({ select: (st) => st.location.pathname })
  const { data: user } = useQuery({ ...sessionQ, enabled: !!localStorage.getItem(TOKEN_KEY) })
  const notice = useRealtime(user?.id)
  const cart = useQuery({ queryKey: ['cart', user?.id], queryFn: api.cart, enabled: !!user })
  useEffect(() => {
    const h = () => { qc.clear(); nav({ to: '/login', search: { redirect: location.pathname } }) }
    window.addEventListener('session-expired', h); return () => window.removeEventListener('session-expired', h)
  }, [qc, nav])
  const logout = async () => { await api.logout().catch(() => {}); localStorage.removeItem(TOKEN_KEY); qc.clear(); nav({ to: '/', search: { page: 1 } }) } // limpa cache privado
  const count = cart.data?.lines.length ?? 0
  const tabs = path === '/' || path.startsWith('/profile') // barra inferior só onde o Figma mobile a mostra
  const item = (on: boolean) => cn('border-b-2 pb-1 hover:text-brand', on ? 'border-brand text-brand' : 'border-transparent')
  return (
    <>
      <header className="mx-auto hidden w-full max-w-[1280px] items-center justify-between gap-4 border-b border-line px-5 py-4 sm:flex">
        <Link to="/" search={{ page: 1 }} className="text-xs font-bold tracking-widest">KURIO</Link>
        <nav aria-label="Principal" className="hidden items-center gap-8 text-xs sm:flex">
          <Link to="/" search={{ page: 1 }} className={item(path === '/')}>Início</Link>
          <Link to="/" search={{ page: 1 }} className={item(path !== '/')}>Mercado</Link>
          <span aria-disabled="true" title="Em breve" className="text-muted/60">Criadores</span>
          <span aria-disabled="true" title="Em breve" className="text-muted/60">Aprenda</span>
        </nav>
        <div className="flex items-center gap-4">
          <Link to="/cart" aria-label={`Carrinho, ${count} item(ns)`} className="relative">
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></svg>
            {count > 0 && <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-brand text-[9px] font-bold text-ink">{count}</span>}
          </Link>
          {user ? <><Link to="/profile" className="text-xs hover:text-brand">Perfil</Link><Button variant="outline" onClick={logout}>Sair</Button></> : <Button variant="outline" asChild><Link to="/login" search={{ redirect: undefined }}>Entrar</Link></Button>}
        </div>
      </header>
      <div role="status" aria-live="polite" className="mx-auto max-w-[1280px] px-5 text-accent">{notice}</div>
      <main className={cn('mx-auto w-full max-w-[1280px] px-5 sm:pb-10', tabs ? 'pb-28' : 'pb-6')}><Outlet /></main>
      <div className="hidden sm:block"><Footer /></div>
      {tabs && <BottomNav count={count} />}
    </>
  )
}

const root = createRootRouteWithContext<Ctx>()({ component: Root, notFoundComponent: () => <p className="py-20">Página não encontrada.</p> })

const COLLECTIONS = ['Cosmic Drift', 'Pixel Pets', 'Neon Skies', 'Abstract Minds']
function Catalog() {
  const s = indexRoute.useSearch(); const nav = indexRoute.useNavigate()
  const set = (p: Partial<typeof s>) => nav({ search: (o) => ({ ...o, ...p }) })
  const q = useQuery({ queryKey: ['nfts', s], queryFn: ({ signal }) => api.nfts({ q: s.q, collection: s.collection, sort: s.sort, minPrice: s.min, maxPrice: s.max, page: s.page }, signal), placeholderData: (p) => p })
  const [range, setRange] = useState({ min: s.min ?? '', max: s.max ?? '' }); const [rangeErr, setRangeErr] = useState(''); const [filtersOpen, setFiltersOpen] = useState(false)
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1
  const hero = !s.q && !s.collection && !s.min && !s.max && !s.sort && s.page === 1
  const tab = (label: string, sort: NftSort | undefined) => <button key={label} aria-pressed={s.sort === sort} onClick={() => set({ sort, page: 1 })} className={cn('whitespace-nowrap border-b-2 pb-1 text-xs', s.sort === sort ? 'border-brand text-brand' : 'border-transparent hover:text-brand')}>{label}</button>
  const grid = 'grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 max-sm:[&>*:nth-child(even)]:mt-8'
  return (
    <>
      <div className="mt-4 flex gap-3 md:justify-end">
        <label className="grow md:max-w-xs md:grow-0"><span className="sr-only">Buscar</span><input defaultValue={s.q} onChange={(e) => set({ q: e.target.value || undefined, page: 1 })} placeholder="Explorar coleções" className="w-full rounded-md border border-line bg-surface px-4 py-3 text-xs md:py-2" /></label>
        <Button variant="outline" className="lg:hidden" aria-expanded={filtersOpen} aria-controls="filtros" onClick={() => setFiltersOpen((v) => !v)}>Filtros</Button>
      </div>
      {hero ? (
        <section aria-labelledby="t" className="mt-4 grid grid-cols-[1fr_38%] items-center gap-4 rounded-2xl bg-surface-dark/60 p-5 md:mt-0 md:grid-cols-2 md:gap-8 md:bg-transparent md:p-0 md:py-10">
          <div className="space-y-3 md:space-y-4"><p className="text-xs">Bem-vindo à Kurio</p><h1 id="t" className="text-xl font-bold leading-tight sm:text-3xl md:text-4xl">SEJA DONO DO FUTURO DA ARTE DIGITAL</h1>
            <p className="max-w-md text-xs text-secondary">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</p>
            <Button asChild><a href="#catalogo">Explorar</a></Button></div>
          <img src={APES[0]} alt="Destaque da coleção Kurio" width={700} height={700} className="aspect-square w-full max-w-md justify-self-end rounded-lg object-cover" />
        </section>
      ) : <h1 id="t" className="py-4 text-xl font-bold md:py-6 md:text-2xl">Mercado</h1>}
      <div id="catalogo" className="mt-6 grid scroll-mt-4 gap-6 md:mt-0 lg:grid-cols-[240px_1fr] lg:gap-8">
        <aside id="filtros" aria-label="Filtros" className={cn('h-fit space-y-6 rounded-lg bg-surface p-5 lg:block', filtersOpen ? 'block' : 'hidden')}>
          <div><h2 className="mb-3 font-bold text-accent">Coleções</h2>
            <ul className="space-y-2 text-xs">{[undefined, ...COLLECTIONS].map((c) => <li key={c ?? 'all'}><button aria-pressed={s.collection === c} onClick={() => set({ collection: c, page: 1 })} className={cn('hover:text-brand', s.collection === c ? 'font-bold text-brand' : 'text-muted')}>{c ?? 'Todas'}</button></li>)}</ul></div>
          <form noValidate onSubmit={(e) => { e.preventDefault(); const a = Number(range.min || 0), b = Number(range.max || Infinity); if (a < 0 || a > b) { setRangeErr('Faixa de preço inválida'); return } setRangeErr(''); set({ min: range.min || undefined, max: range.max || undefined, page: 1 }) }} className="space-y-2">
            <h2 className="font-bold text-accent">Faixa de preço</h2>
            <label className="block text-xs">Mínimo (ETH)<input type="number" min={0} step="0.01" value={range.min} onChange={(e) => setRange({ ...range, min: e.target.value })} className="mt-1 w-full rounded border border-line bg-ink px-2 py-1" /></label>
            <label className="block text-xs">Máximo (ETH)<input type="number" min={0} step="0.01" value={range.max} onChange={(e) => setRange({ ...range, max: e.target.value })} className="mt-1 w-full rounded border border-line bg-ink px-2 py-1" /></label>
            <p role="alert" className="text-xs text-red-300">{rangeErr}</p><Button type="submit">Aplicar</Button>
          </form>
        </aside>
        <section aria-label="NFTs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex gap-5 overflow-x-auto">{tab('Todos os NFTs', undefined)}{tab('Novos lançamentos', 'newest')}{tab('Em alta', 'trending')}</div>
            <label className="text-xs">Ordenar por <select value={s.sort ?? ''} onChange={(e) => set({ sort: (e.target.value || undefined) as NftSort | undefined, page: 1 })} className="rounded border border-line bg-surface px-2 py-1.5"><option value="">Relevância</option><option value="newest">Mais recentes</option><option value="trending">Em alta</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">Nome</option></select></label>
          </div>
          {q.isError ? <div role="alert">Não foi possível carregar. <Button variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button></div>
            : q.isPending ? <div className={grid} aria-busy>{Array.from({ length: 6 }, (_, i) => <NftCardSkeleton key={i} />)}</div>
            : q.data.items.length === 0 ? <p>Nenhum NFT encontrado para esses filtros.</p>
            : <div className={grid}>{q.data.items.map((n) => <NftCard key={n.id} nft={n} />)}</div>}
          <nav aria-label="Paginação" className="mt-8 flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
            <Button variant="outline" disabled={s.page <= 1} onClick={() => set({ page: s.page - 1 })}>Anterior</Button>
            <span className="text-xs">Página {s.page} de {pages}</span>
            <Button variant="outline" disabled={s.page >= pages} onClick={() => set({ page: s.page + 1 })}>Próxima</Button>
          </nav>
        </section>
      </div>
    </>
  )
}
const numStr = (v: unknown) => (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? v : undefined)
const indexRoute = createRoute({
  getParentRoute: () => root, path: '/', component: Catalog,
  validateSearch: (s: Record<string, unknown>): { q?: string; collection?: string; sort?: NftSort; min?: string; max?: string; page: number } => ({ min: numStr(s.min), max: numStr(s.max), q: typeof s.q === 'string' ? s.q : undefined, collection: typeof s.collection === 'string' ? s.collection : undefined, sort: (['price-asc', 'price-desc', 'name', 'newest', 'trending'] as const).find((x) => x === s.sort), page: Math.max(1, Number(s.page) || 1) }),
})

function Detail() {
  const { id } = nftRoute.useParams(); const nav = useNavigate(); const qc = useQueryClient()
  const [qty, setQty] = useState(1); const [error, setError] = useState('')
  const q = useQuery({ queryKey: ['nft', id], queryFn: ({ signal }) => api.nft(id, signal), retry: (n, e) => !(axios.isAxiosError(e) && e.response?.status === 404) && n < 2 })
  const add = useMutation({ mutationFn: () => api.setQty(id, qty), onSuccess: (c) => { qc.setQueryData(['cart', qc.getQueryData<{ id: string }>(['session'])?.id], c); nav({ to: '/cart' }) }, onError: (e) => { if (axios.isAxiosError(e) && e.response?.status === 401) nav({ to: '/login', search: { redirect: `/nft/${id}` } }); else setError(msg(e)) } })
  const more = useQuery({ queryKey: ['nfts', 'more', q.data?.collection], queryFn: () => api.nfts({ collection: q.data?.collection, page: 1, pageSize: 6 }), enabled: !!q.data })
  const me = useQuery({ ...sessionQ, enabled: !!localStorage.getItem(TOKEN_KEY) })
  const favKey = ['favorites', me.data?.id]
  const favs = useQuery({ queryKey: favKey, queryFn: api.favorites, enabled: !!me.data })
  const isFav = favs.data?.includes(id) ?? false
  const [favError, setFavError] = useState('')
  // Atualização otimista com rollback se a API falhar.
  const toggleFav = useMutation({
    mutationFn: (next: boolean) => (next ? api.addFavorite(id) : api.removeFavorite(id)),
    onMutate: async (next) => { setFavError(''); await qc.cancelQueries({ queryKey: favKey }); const prev = qc.getQueryData<string[]>(favKey); qc.setQueryData<string[]>(favKey, (o = []) => (next ? [...new Set([...o, id])] : o.filter((x) => x !== id))); return { prev } },
    onError: (_e, _n, ctx) => { qc.setQueryData(favKey, ctx?.prev); setFavError('Não foi possível atualizar os favoritos. Tente novamente.') },
    onSettled: () => qc.invalidateQueries({ queryKey: favKey }),
  })
  if (q.isPending) return <div className="grid gap-8 md:grid-cols-2 py-6" aria-busy><Skeleton className="aspect-square" /><div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-12 w-full" /></div></div>
  if (q.isError) return <div role="alert" className="py-20">{axios.isAxiosError(q.error) && q.error.response?.status === 404 ? 'NFT não encontrado.' : 'Falha ao carregar o NFT.'} <Link to="/" search={{ page: 1 }} className="underline">Voltar ao início</Link></div>
  const n = q.data
  return (
    <>
      <p className="hidden py-4 text-xs sm:block">Início / Mercado / {n.name}</p>
      <article className="grid gap-6 pb-48 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4 sm:pb-0">
        <div className="relative -mx-5 rounded-b-2xl bg-surface p-4 pt-14 sm:row-span-2 sm:mx-0 sm:rounded-lg sm:p-4">
          <BackButton className="absolute left-4 top-4" />
          <img src={n.image} alt={`${n.name}, da coleção ${n.collection}`} width={600} height={600} className="aspect-square w-full rounded-md object-cover" />
        </div>
        <div className="space-y-4">
          <h1 className="text-xl font-bold sm:text-2xl">{n.name}</h1>
          <p className="hidden text-xl font-bold text-accent sm:block">{n.priceEth} ETH</p>
          <p className="text-xs text-secondary">Colecionável digital da coleção {n.collection}, com procedência verificada e registro permanente de propriedade.</p>
          <p className="text-xs">{n.stock > 0 ? `${n.stock} unidade(s) disponível(is)` : 'Edição esgotada'}</p>
          <dl className="space-y-1 text-xs text-secondary"><div>ID do token: #{String(n.id).padStart(4, '0')}</div><div>Coleção: {n.collection}</div></dl>
          <p role="alert" className="text-red-300">{error || favError}</p>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 space-y-3 rounded-t-2xl border-t border-line bg-surface p-4 sm:static sm:z-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><span id="qlbl" className="text-xs">Quantidade</span>
              <Button variant="outline" className="size-8 p-0" aria-label="Diminuir quantidade" onClick={() => setQty((v) => Math.max(1, v - 1))}>−</Button>
              <input aria-labelledby="qlbl" type="number" min={1} max={Math.max(1, n.stock)} value={qty} onChange={(e) => setQty(Math.min(Math.max(1, Math.floor(Number(e.target.value) || 1)), Math.max(1, n.stock)))} className="w-14 rounded border border-line bg-ink px-2 py-1 text-center" />
              <Button variant="outline" className="size-8 p-0" aria-label="Aumentar quantidade" onClick={() => setQty((v) => Math.min(Math.max(1, n.stock), v + 1))}>+</Button></div>
            <span className="text-lg font-bold text-accent sm:hidden">{n.priceEth} ETH</span>
          </div>
          <div className="flex gap-3">
            <Button className="grow sm:grow-0" disabled={n.stock === 0 || add.isPending} onClick={() => { setError(''); add.mutate() }}>{add.isPending ? 'Adicionando…' : 'Comprar'}</Button>
            <Button variant="outline" aria-pressed={isFav} onClick={() => (me.data ? toggleFav.mutate(!isFav) : nav({ to: '/login', search: { redirect: `/nft/${id}` } }))}>{isFav ? '★ Favoritado' : '☆ Favoritar'}</Button>
          </div>
        </div>
      </article>
      <section aria-labelledby="det" className="mt-10"><h2 id="det" className="border-b border-line pb-2 font-bold text-accent">Detalhes do NFT</h2>
        <p className="mt-4 max-w-3xl text-xs leading-6 text-secondary">{n.name} faz parte da coleção {n.collection}. A propriedade fica registrada na rede escolhida no pagamento, e o recibo do pedido reúne o hash da transação para consulta.</p></section>
      <section aria-labelledby="more" className="mt-10"><h2 id="more" className="border-b border-line pb-2 font-bold text-accent">Mais desta coleção</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{(more.data?.items ?? []).filter((x) => x.id !== n.id).slice(0, 5).map((x) => <NftCard key={x.id} nft={x} />)}</div></section>
    </>
  )
}
const nftRoute = createRoute({ getParentRoute: () => root, path: '/nft/$id', component: Detail })

function CartPage() {
  const qc = useQueryClient(); const [code, setCode] = useState(''); const [couponErr, setCouponErr] = useState('')
  const { data: user } = useQuery({ ...sessionQ })
  const key = ['cart', user?.id]
  const cart = useQuery({ queryKey: key, queryFn: api.cart, enabled: !!user })
  // Atualização otimista com rollback em caso de falha.
  const setQty = useMutation({
    mutationFn: (v: { id: string; qty: number }) => api.setQty(v.id, v.qty),
    onMutate: async (v) => { await qc.cancelQueries({ queryKey: key }); const prev = qc.getQueryData<Cart>(key); qc.setQueryData<Cart>(key, (c) => c && { ...c, lines: c.lines.map((l) => (l.nft.id === v.id ? { ...l, qty: v.qty } : l)) }); return { prev } },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
  const remove = useMutation({ mutationFn: api.removeItem, onSuccess: (c) => qc.setQueryData(key, c) })
  const coupon = useMutation({ mutationFn: api.applyCoupon, onSuccess: (c) => { setCouponErr(''); qc.setQueryData(key, c) }, onError: (e) => setCouponErr(msg(e)) })
  const recs = useQuery({ queryKey: ['nfts', 'recs'], queryFn: () => api.nfts({ page: 1, pageSize: 5, sort: 'trending' }) })
  if (cart.isPending) return <div className="grid gap-4 py-6" aria-busy><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-40" /></div>
  if (cart.isError) return <div role="alert" className="py-20">Falha ao carregar o carrinho. <Button variant="outline" onClick={() => cart.refetch()}>Tentar novamente</Button></div>
  const c = cart.data
  const cols = 'md:grid-cols-[1fr_90px_130px_100px_90px]'
  return (
    <section className="py-4 sm:py-6">
      <div className="mb-4 flex items-center gap-3"><BackButton /><h1 className="grow text-center text-lg font-bold sm:sr-only sm:text-left">Carrinho de NFTs</h1><span className="w-9 sm:hidden" aria-hidden /></div>
      <p className="mb-4 hidden text-xs sm:block">Início / Mercado / Carrinho</p>
      {c.lines.length === 0 ? <p>Seu carrinho está vazio. <Link to="/" search={{ page: 1 }} className="underline">Explorar NFTs</Link></p> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:gap-8">
          <div>
            <div aria-hidden className={cn('hidden gap-4 px-3 pb-2 text-xs font-bold md:grid', cols)}><span>NFTs</span><span>Preço</span><span>Edições</span><span>Total</span><span /></div>
            <ul className="space-y-3 md:space-y-2">{c.lines.map((l) => (
              <li key={l.nft.id} className={cn('grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-md bg-surface p-3', cols)}>
                <div className="flex items-center gap-3"><img src={l.nft.image} alt="" width={64} height={64} className="size-16 rounded object-cover md:size-12" /><div><p className="text-xs font-bold">{l.nft.name}</p><p className="text-[11px] text-secondary">ID do token: #{String(l.nft.id).padStart(4, '0')}</p></div></div>
                <span className="col-start-1 text-sm font-bold text-accent md:col-auto md:text-xs">{l.nft.priceEth} ETH</span>
                <div className="col-start-2 row-start-1 flex items-center gap-1 md:col-auto md:row-auto">
                  <Button variant="outline" className="size-6 rounded-full p-0" aria-label={`Diminuir ${l.nft.name}`} disabled={l.qty <= 1} onClick={() => setQty.mutate({ id: l.nft.id, qty: l.qty - 1 })}>−</Button>
                  <input aria-label={`Quantidade de ${l.nft.name}`} type="number" min={1} max={l.nft.stock} value={l.qty} onChange={(e) => setQty.mutate({ id: l.nft.id, qty: Math.floor(Number(e.target.value)) })} className="w-10 rounded border border-line bg-ink px-1 py-1 text-center" />
                  <Button variant="outline" className="size-6 rounded-full p-0" aria-label={`Aumentar ${l.nft.name}`} disabled={l.qty >= l.nft.stock} onClick={() => setQty.mutate({ id: l.nft.id, qty: l.qty + 1 })}>+</Button></div>
                <span className="hidden text-xs font-bold text-accent md:block">{fromWei(toWei(l.nft.priceEth) * BigInt(l.qty))} ETH</span>
                <Button variant="outline" className="col-start-2 row-start-2 justify-self-end md:col-auto md:row-auto" onClick={() => remove.mutate(l.nft.id)} aria-label={`Remover ${l.nft.name}`}>Remover</Button>
              </li>))}</ul>
          </div>
          <aside aria-label="Resumo" className="sticky bottom-0 -mx-5 h-fit space-y-3 rounded-t-3xl bg-surface px-5 py-4 lg:static lg:mx-0 lg:rounded-none lg:bg-transparent lg:p-0">
            <h2 className="hidden border-b border-line pb-2 font-bold lg:block">Resumo da carteira</h2>
            <form onSubmit={(e: FormEvent) => { e.preventDefault(); coupon.mutate(code) }} className="flex"><label className="grow"><span className="mb-1 block text-xs font-bold">Código promocional</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Digite o código promocional..." aria-describedby="cerr" className="w-full rounded-l border border-line bg-ink px-3 py-2 text-xs lg:bg-surface" /></label><Button type="submit" className="self-end rounded-l-none">Aplicar</Button></form>
            <p id="cerr" role="alert" className="text-xs text-red-300">{couponErr}</p>
            <dl className="space-y-2 text-xs"><div className="flex justify-between"><dt>Subtotal</dt><dd>{c.subtotal} ETH</dd></div><div className="flex justify-between"><dt>Desconto do lançamento</dt><dd>(-) {c.discount}</dd></div><div className="flex justify-between"><dt>Taxa de rede</dt><dd>{c.networkFee} ETH</dd></div><div className="flex justify-between border-t border-line pt-2 font-bold"><dt>Total</dt><dd className="text-accent">{c.total} ETH</dd></div></dl>
            <Button asChild className="w-full"><Link to="/checkout">Conectar e finalizar</Link></Button>
            <p className="hidden text-center lg:block"><Link to="/" search={{ page: 1 }} className="text-xs text-brand underline">Continuar explorando</Link></p>
          </aside>
        </div>)}
      <section aria-labelledby="rec" className="mt-12"><h2 id="rec" className="border-b border-line pb-2 font-bold text-accent">Colecionadores também viram</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{(recs.data?.items ?? []).map((x) => <NftCard key={x.id} nft={x} />)}</div></section>
    </section>
  )
}
const cartRoute = createRoute({ getParentRoute: () => root, path: '/cart', component: CartPage, beforeLoad: () => { if (!localStorage.getItem(TOKEN_KEY)) throw redirect({ to: '/login', search: { redirect: '/cart' } }) } })

function Login() {
  const { redirect: back } = loginRoute.useSearch(); const qc = useQueryClient(); const nav = useNavigate(); const [error, setError] = useState(''); const [hint, setHint] = useState('')
  const m = useMutation({ mutationFn: (v: { email: string; password: string }) => api.login(v.email, v.password), onSuccess: ({ token, user }) => { qc.clear(); localStorage.setItem(TOKEN_KEY, token); qc.setQueryData(['session'], user); nav({ to: back ?? '/' }) }, onError: (e) => setError(msg(e)) })
  return (
    <AuthCard mode="login" back={back} subtitle="Entre para gerenciar sua carteira, coleção e perfil de criador.">
      <form noValidate onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setError(''); m.mutate({ email: String(f.get('email')), password: String(f.get('password')) }) }}>
        <Field label="E-mail" name="email" type="email" required defaultValue="ana@demo.dev" autoComplete="email" />
        <PasswordField label="Senha" name="password" required defaultValue="demo1234" autoComplete="current-password" />
        <p role="alert" className="text-xs text-red-300">{error}</p>
        <button type="button" onClick={() => setHint('Recuperação de senha indisponível na simulação.')} className="mb-3 block w-full text-right text-[11px] text-brand underline">Esqueceu a senha?</button>
        <p role="status" className="mb-2 text-[11px] text-secondary">{hint}</p>
        <Button type="submit" disabled={m.isPending} className="w-full">{m.isPending ? 'Entrando…' : 'Entrar'}</Button>
      </form>
    </AuthCard>
  )
}
const loginRoute = createRoute({ getParentRoute: () => root, path: '/login', component: Login, validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s.redirect === 'string' && s.redirect.startsWith('/') ? s.redirect : undefined }) })

const guard = (to: string) => () => { if (!localStorage.getItem(TOKEN_KEY)) throw redirect({ to: '/login', search: { redirect: to } }) }
const checkoutRoute = createRoute({ getParentRoute: () => root, path: '/checkout', component: CheckoutPage, beforeLoad: guard('/checkout') })
const orderRoute = createRoute({ getParentRoute: () => root, path: '/orders/$id', component: OrderPage, beforeLoad: guard('/checkout') })

const registerRoute = createRoute({ getParentRoute: () => root, path: '/register', component: RegisterPage, validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({ redirect: typeof s.redirect === 'string' && s.redirect.startsWith('/') ? s.redirect : undefined }) })

const profileRoute = createRoute({ getParentRoute: () => root, path: '/profile', component: ProfileShell, beforeLoad: guard('/profile') })
const profileChildren = [
  createRoute({ getParentRoute: () => profileRoute, path: '/', component: ProfileData }),
  createRoute({ getParentRoute: () => profileRoute, path: 'wallets', component: WalletsPage }),
  createRoute({ getParentRoute: () => profileRoute, path: 'favorites', component: FavoritesPage }),
]

export const makeRouter = (qc: QueryClient) => createRouter({ routeTree: root.addChildren([indexRoute, nftRoute, cartRoute, loginRoute, checkoutRoute, orderRoute, registerRoute, profileRoute.addChildren(profileChildren)]), context: { qc }, defaultPreload: 'intent' })
declare module '@tanstack/react-router' { interface Register { router: ReturnType<typeof makeRouter> } }
