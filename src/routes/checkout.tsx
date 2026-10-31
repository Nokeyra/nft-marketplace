import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import axios from 'axios'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { BackButton } from '../components/back-button'
import { Field, SelectField, TextAreaField } from '../components/field'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { api, errorBody, errorMessage, sessionQuery } from '../lib/api'
import { fromWei, toWei } from '../lib/eth'
import type { Cart, Wallet } from '../lib/types'
import { EMPTY_FORM, NETWORKS, validateCheckout, WALLET_TYPES, type CheckoutForm } from '../lib/validate'

const line = (price: string, qty: number) => fromWei(toWei(price) * BigInt(qty))
const Thumb = ({ src }: { src: string }) => <img src={src} alt="" width={40} height={40} className="size-10 rounded object-cover" />

const Totals = ({ c, fee = true }: { c: Pick<Cart, 'subtotal' | 'discount' | 'networkFee' | 'total'>; fee?: boolean }) => (
  <dl className="space-y-2 text-xs">
    {fee && <><div className="flex justify-between"><dt>Subtotal</dt><dd>{c.subtotal} ETH</dd></div><div className="flex justify-between"><dt>Desconto do lançamento</dt><dd>(-) {c.discount}</dd></div></>}
    <div className="flex justify-between"><dt>Taxa de rede</dt><dd>{c.networkFee} ETH</dd></div>
    <div className="flex justify-between border-t border-line pt-2 font-bold"><dt>Total</dt><dd className="text-accent">{c.total} ETH</dd></div>
  </dl>
)

export function CheckoutPage() {
  const qc = useQueryClient(); const nav = useNavigate()
  const { data: user } = useQuery(sessionQuery)
  const cartKey = ['cart', user?.id]
  const cart = useQuery({ queryKey: cartKey, queryFn: api.cart, enabled: !!user })
  const wallets = useQuery({ queryKey: ['wallets', user?.id], queryFn: api.wallets, enabled: !!user })
  const pending = useQuery({ queryKey: ['orders', 'pending', user?.id], queryFn: api.pendingOrder, enabled: !!user, staleTime: 0 })
  const [f, setF] = useState<CheckoutForm>(EMPTY_FORM); const [useOther, setUseOther] = useState(false); const [walletId, setWalletId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({}); const [formError, setFormError] = useState('')
  const [step, setStep] = useState<'form' | 'review'>('form'); const [ack, setAck] = useState('')
  const set = (k: keyof CheckoutForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }))

  useEffect(() => { // preenche o que já é conhecido da conta
    if (user) setF((p) => ({ ...p, displayName: p.displayName || user.name, profileName: p.profileName || user.name, email: p.email || user.email, username: p.username || user.email.split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 20) }))
  }, [user])
  useEffect(() => { if (pending.data) nav({ to: '/orders/$id', params: { id: pending.data.id }, replace: true }) }, [pending.data, nav]) // retoma pedido pendente
  useEffect(() => { if (wallets.data && !walletId) setWalletId(wallets.data.find((w) => w.primary)?.id ?? wallets.data[0]?.id ?? '') }, [wallets.data, walletId])
  const wallet = wallets.data?.find((w) => w.id === walletId)
  useEffect(() => { if (wallet && !useOther) setF((p) => ({ ...p, walletAddress: wallet.address, network: p.network || wallet.network, walletType: p.walletType || wallet.walletType, referralCode: p.referralCode || wallet.referralCode, ens: p.ens || wallet.ens })) }, [wallet, useOther])

  const setWallet = (w: Wallet) => qc.setQueryData<Wallet[]>(['wallets', user?.id], (old) => old?.map((x) => (x.id === w.id ? w : { ...x, connected: w.connected ? false : x.connected })))
  const connect = useMutation({ mutationFn: () => api.connectWallet(walletId), onSuccess: (w) => { setFormError(''); setWallet(w) }, onError: (e) => setFormError(errorMessage(e)) })
  const disconnect = useMutation({ mutationFn: () => api.disconnectWallet(walletId), onSuccess: setWallet })

  // A mesma tentativa reutiliza a chave (retry após timeout recupera o mesmo pedido); mudou o conteúdo, nova chave.
  const content = JSON.stringify({ ack, walletId, f })
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [content]) // eslint-disable-line react-hooks/exhaustive-deps
  const create = useMutation({
    mutationFn: () => api.createOrder(idempotencyKey, { ...f, quoteTotal: ack, walletId }),
    onSuccess: (o) => { qc.setQueryData(['order', o.id], o); nav({ to: '/orders/$id', params: { id: o.id } }) },
    onError: (e) => {
      const b = errorBody(e)
      if (b?.cart) qc.setQueryData(cartKey, b.cart); else if (axios.isAxiosError(e) && e.response?.status === 409) qc.invalidateQueries({ queryKey: cartKey })
      if (b?.fields) { setErrors(b.fields); setStep('form') }
      setFormError(b?.code === 'QUOTE_CHANGED' || b?.code === 'STOCK_CONFLICT' ? `${b.message}` : `${errorMessage(e)} Você pode tentar novamente sem duplicar o pedido.`)
    },
  })

  if (cart.isPending || wallets.isPending) return <div className="grid gap-4 py-6" aria-busy><Skeleton className="h-8 w-1/3" /><Skeleton className="h-96" /></div>
  if (cart.isError || wallets.isError) return <div role="alert" className="py-20">Falha ao carregar o pagamento. <Button variant="outline" onClick={() => { cart.refetch(); wallets.refetch() }}>Tentar novamente</Button></div>
  const c = cart.data
  if (c.lines.length === 0) return <p className="py-20">Seu carrinho está vazio. <Link to="/" search={{ page: 1 }} className="underline">Explorar NFTs</Link></p>
  const changed = step === 'review' && c.total !== ack // preço/estoque/cupom/taxa mudaram durante a revisão
  const review = (e: { preventDefault(): void }) => {
    e.preventDefault(); setFormError('')
    const v = validateCheckout(f); if (!wallet) v.wallet = 'Selecione uma carteira'; else if (!wallet.connected) v.wallet = 'Conecte a carteira para continuar'
    setErrors(v); if (Object.keys(v).length === 0) { setAck(c.total); setStep('review') }
  }

  return (
    <>
      <div className="flex items-center gap-3 py-4"><BackButton /><p className="text-xs">Início / Mercado / Pagamento</p></div>
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <form id="checkout-form" noValidate onSubmit={review}>
          <h1 className="mb-4 font-bold">Perfil do colecionador</h1>
          <fieldset disabled={step === 'review'} className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Nome de exibição" required value={f.displayName} onChange={set('displayName')} error={errors.displayName} autoComplete="name" />
            <Field label="Nome de usuário" required value={f.username} onChange={set('username')} error={errors.username} autoComplete="username" />
            <SelectField label="Rede" required value={f.network} onChange={set('network')} error={errors.network}><option value="">Selecione uma rede</option>{NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</SelectField>
            <Field label="Nome do perfil" required value={f.profileName} onChange={set('profileName')} error={errors.profileName} />
            <Field label="Endereço da carteira" required placeholder="Endereço 0x da carteira" value={f.walletAddress} onChange={set('walletAddress')} readOnly={!useOther} error={errors.walletAddress} />
            <Field label="Carteira secundária" placeholder="ENS ou carteira secundária (opcional)" value={f.secondary} onChange={set('secondary')} error={errors.secondary} />
            <SelectField label="Tipo de carteira" required value={f.walletType} onChange={set('walletType')} error={errors.walletType}><option value="">Selecione uma carteira</option>{WALLET_TYPES.map((w) => <option key={w}>{w}</option>)}</SelectField>
            <Field label="Código de indicação" required value={f.referralCode} onChange={set('referralCode')} error={errors.referralCode} />
            <Field label="E-mail" type="email" required value={f.email} onChange={set('email')} error={errors.email} autoComplete="email" />
            <div className="flex items-start gap-2"><Field className="grow" label="Nome ENS" required value={f.ens} onChange={set('ens')} error={errors.ens} /><span className="mt-6 text-xs text-secondary">.eth</span></div>
            <label className="col-span-full mb-4 flex items-center gap-2 text-xs"><input type="checkbox" checked={useOther} onChange={(e) => setUseOther(e.target.checked)} />Usar outra carteira?</label>
            <TextAreaField className="col-span-full max-w-sm" label="Observação do colecionador (opcional)" value={f.note} onChange={set('note')} error={errors.note} />
          </fieldset>
        </form>

        <aside aria-label="Resumo do pedido" className="h-fit space-y-4">
          <h2 className="font-bold">Seus NFTs</h2>
          <ul className="space-y-2">{c.lines.map((l) => (
            <li key={l.nft.id} className="flex items-center gap-3 rounded-md bg-surface p-2"><img src={l.nft.image} alt="" width={40} height={40} className="size-10 rounded object-cover" />
              <div className="grow"><p className="text-xs font-bold">{l.nft.name}</p><p className="text-[11px] text-secondary">ID do token: #{String(l.nft.id).padStart(4, '0')}</p></div>
              <span className="text-[11px] text-muted">(x {l.qty})</span><span className="text-xs font-bold text-accent">{line(l.nft.priceEth, l.qty)} ETH</span></li>))}</ul>
          <p className="text-center text-xs">Tem um código promocional? <Link to="/cart" className="text-brand underline">Aplique aqui</Link></p>
          <Totals c={c} />
          <fieldset disabled={step === 'review'} className="space-y-2"><legend className="mb-2 w-full text-center font-bold">Carteira e rede</legend>
            {wallets.data.map((w) => (
              <label key={w.id} className={`flex cursor-pointer items-center gap-3 rounded border p-3 text-xs ${w.id === walletId ? 'border-brand' : 'border-line'}`}><input type="radio" name="wallet" checked={w.id === walletId} onChange={() => setWalletId(w.id)} />
                <span className="grow">{w.label}<br /><span className="text-[11px] text-secondary">{w.address.slice(0, 8)}…{w.address.slice(-4)}</span></span><span>{w.connected ? 'Conectada' : 'Desconectada'}</span></label>))}
            <div className="flex gap-2"><Button type="button" variant="outline" disabled={!wallet || wallet.connected || connect.isPending} onClick={() => connect.mutate()}>{connect.isPending ? 'Conectando…' : 'Conectar carteira'}</Button>
              <Button type="button" variant="outline" disabled={!wallet?.connected} onClick={() => disconnect.mutate()}>Desconectar</Button></div>
            <p role="alert" className="text-[11px] text-red-300">{errors.wallet}</p>
          </fieldset>
          {changed && <div role="alert" className="space-y-2 rounded-md border border-brand p-3 text-xs"><p>Os valores mudaram de {ack} para {c.total} ETH. Revise e aceite para continuar.</p><Button variant="outline" onClick={() => { setFormError(''); setAck(c.total) }}>Aceitar novos valores</Button></div>}
          <p role="alert" className="text-xs text-red-300">{formError}</p>
          {step === 'form' ? <Button type="submit" form="checkout-form" className="w-full">Revisar pedido</Button> : (
            <div className="flex gap-2"><Button variant="outline" onClick={() => setStep('form')}>Editar</Button>
              <Button className="grow" disabled={changed || create.isPending} onClick={() => { setFormError(''); create.mutate() }}>{create.isPending ? 'Enviando pedido…' : 'Confirmar compra'}</Button></div>)}
        </aside>
      </div>
    </>
  )
}

export function OrderPage() {
  const { id } = useParams({ strict: false }) as { id: string }; const qc = useQueryClient()
  const order = useQuery({ queryKey: ['order', id], queryFn: () => api.order(id), retry: (n, e) => axios.isAxiosError(e) && e.response?.status === 404 ? false : n < 2,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 2000 : false) }) // fallback por REST se o socket cair
  const status = order.data?.status
  useEffect(() => { if (status === 'confirmed') { qc.invalidateQueries({ queryKey: ['cart'] }); qc.invalidateQueries({ queryKey: ['nfts'] }) } }, [status, qc])
  if (order.isPending) return <div className="mx-auto max-w-xl space-y-4 py-10" aria-busy><Skeleton className="h-10" /><Skeleton className="h-72" /></div>
  if (order.isError) return <div role="alert" className="py-20">{['NOT_FOUND', 'FORBIDDEN'].includes(errorBody(order.error)?.code ?? '') ? 'Pedido não encontrado.' : 'Falha ao carregar o pedido.'} <Button variant="outline" onClick={() => order.refetch()}>Tentar novamente</Button></div>
  const o = order.data
  if (o.status === 'pending') return <div role="status" className="py-20 space-y-3 text-center"><h1 className="text-2xl font-bold">Confirmando seu pedido…</h1><p className="text-secondary">Pedido {o.id} aguardando a rede. Você pode recarregar a página sem perder o pedido.</p></div>
  if (o.status === 'rejected') return <div role="alert" className="py-20 space-y-3 text-center"><h1 className="text-2xl font-bold">Pedido recusado</h1><p>{o.reason}. Seus itens continuam no carrinho.</p><Button asChild><Link to="/cart">Voltar ao carrinho</Link></Button></div>
  const net = NETWORKS.find((n) => n.id === o.network)?.label ?? o.network
  const meta: [string, string][] = [['ID da transação', `${o.txHash?.slice(0, 7)}…${o.txHash?.slice(-4)}`], ['Data', new Date(o.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })], ['Total', `${o.total} ETH`], ['Carteira', o.wallet.label]]
  return (
    <article aria-labelledby="ok" className="relative mx-auto my-10 max-w-xl rounded-md border-b-8 border-brand bg-surface">
      <Link to="/" search={{ page: 1 }} aria-label="Fechar" className="absolute right-3 top-3 text-brand">×</Link>
      <header className="space-y-3 border-b border-line-soft p-6 text-center"><svg aria-hidden width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#d28a4c" strokeWidth="1.5" className="mx-auto"><rect x="3" y="8" width="18" height="12" rx="1" /><path d="m3 9 9 6 9-6M7 8V4h10v4" /></svg>
        <h1 id="ok" className="text-sm font-bold text-muted">Pedido confirmado: seus NFTs agora estão na sua carteira</h1></header>
      <dl className="grid grid-cols-2 gap-3 border-b border-line-soft p-4 text-xs sm:grid-cols-4">{meta.map(([k, v]) => <div key={k}><dt className="text-secondary">{k}</dt><dd className="break-all font-bold">{v}</dd></div>)}</dl>
      <div className="space-y-3 p-6"><h2 className="text-xs font-bold">Detalhes da transação</h2>
        <ul className="space-y-2">{o.items.map((i) => <li key={i.nftId} className="flex items-center gap-3"><Thumb src={i.image} /><div className="grow"><p className="text-xs font-bold">{i.name}</p><p className="text-[11px] text-secondary">ID do token: #{String(i.nftId).padStart(4, '0')}</p></div><span className="text-[11px] text-muted">(x {i.qty})</span><span className="w-24 text-right text-xs font-bold text-accent">{line(i.priceEth, i.qty)} ETH</span></li>)}</ul>
        <Totals c={o} fee={false} />
        <p className="text-center text-[11px] text-secondary">Transação confirmada na {net}. A propriedade foi transferida para sua carteira conectada e registrada na rede.</p>
        <div className="text-center"><Button asChild><a href={`https://etherscan.io/tx/${o.txHash}`} target="_blank" rel="noopener noreferrer">Ver no Etherscan</a></Button></div></div>
    </article>
  )
}
