import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { PasswordField } from '../components/auth'
import { Field, SelectField } from '../components/field'
import { NftCard, NftCardSkeleton } from '../components/nft-card'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { api, errorBody, errorMessage, sessionQuery, TOKEN_KEY } from '../lib/api'
import { cn } from '../lib/utils'
import type { Profile, Wallet } from '../lib/types'
import { EMPTY_WALLET, NETWORKS, validateProfile, validateWallet, WALLET_TYPES, type WalletForm } from '../lib/validate'

const DISABLED = ['Atividade', 'Ofertas', 'Arquivos baixados', 'Suporte']

export function ProfileShell() {
  const qc = useQueryClient(); const nav = useNavigate()
  const link = 'block whitespace-nowrap border-l-4 px-3 py-2 text-xs hover:text-brand'
  const logout = async () => { await api.logout().catch(() => {}); localStorage.removeItem(TOKEN_KEY); qc.clear(); nav({ to: '/', search: { page: 1 } }) }
  return (
    <div className="grid gap-8 py-8 lg:grid-cols-[260px_1fr]">
      <nav aria-label="Meu perfil" className="flex h-fit overflow-x-auto rounded-md bg-surface py-3 lg:block lg:overflow-visible">
        <p className="hidden px-3 pb-2 font-bold lg:block">Meu perfil</p>
        <Link to="/profile" activeOptions={{ exact: true }} className={link} activeProps={{ className: 'border-brand text-brand' }} inactiveProps={{ className: 'border-transparent text-muted' }}>Dados do perfil</Link>
        <Link to="/profile/wallets" className={link} activeProps={{ className: 'border-brand text-brand' }} inactiveProps={{ className: 'border-transparent text-muted' }}>Carteiras</Link>
        <Link to="/profile/favorites" className={link} activeProps={{ className: 'border-brand text-brand' }} inactiveProps={{ className: 'border-transparent text-muted' }}>Lista de interesse</Link>
        {DISABLED.map((d) => <span key={d} aria-disabled="true" title="Em breve" className={cn(link, 'border-transparent text-muted/50')}>{d}</span>)}
        <button onClick={logout} className={cn(link, 'mt-2 w-full border-t border-line border-l-transparent text-left font-bold text-brand')}>Sair</button>
      </nav>
      <div><Outlet /></div>
    </div>
  )
}

// ---------- Dados do perfil
function ProfileForm({ initial }: { initial: Profile }) {
  const qc = useQueryClient(); const fileRef = useRef<HTMLInputElement>(null)
  const [f, setF] = useState({ displayName: initial.displayName, username: initial.username, email: initial.email, ens: initial.ens, nickname: initial.nickname })
  const [avatar, setAvatar] = useState(initial.avatar); const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({}); const [status, setStatus] = useState('')
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }))
  const save = useMutation({
    mutationFn: () => api.saveProfile({ ...f, avatar, currentPassword: pw.current || undefined, newPassword: pw.next || undefined }),
    onSuccess: (p) => { qc.setQueryData(['profile'], p); qc.setQueryData<{ id: string; name: string; email: string }>(['session'], (o) => o && { ...o, name: p.displayName, email: p.email }); setPw({ current: '', next: '', confirm: '' }); setErrors({}); setStatus('Perfil salvo.') },
    onError: (e) => { const b = errorBody(e); setErrors(b?.fields ?? {}); setStatus(b?.fields ? '' : errorMessage(e)) },
  })
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type) || file.size > 150_000) { setErrors((p) => ({ ...p, avatar: 'Use PNG, JPG ou WebP de até 150 KB' })); return }
    const r = new FileReader(); r.onload = () => { setAvatar(String(r.result)); setErrors((p) => ({ ...p, avatar: '' })) }; r.readAsDataURL(file)
  }
  const submit = (e: FormEvent) => { e.preventDefault(); setStatus(''); const v = validateProfile(f, pw); setErrors(v); if (!Object.keys(v).length) save.mutate() }
  return (
    <form noValidate onSubmit={submit}>
      <h1 className="mb-4 font-bold">Perfil do colecionador</h1>
      <div className="grid gap-x-6 md:grid-cols-2">
        <Field label="Nome de exibição" required value={f.displayName} onChange={set('displayName')} error={errors.displayName} />
        <Field label="Nome de usuário" required value={f.username} onChange={set('username')} error={errors.username} />
        <Field label="E-mail" type="email" required value={f.email} onChange={set('email')} error={errors.email} />
        <div className="flex items-start gap-2"><Field className="grow" label="Nome ENS" required value={f.ens} onChange={set('ens')} error={errors.ens} /><span className="mt-6 text-xs text-secondary">.eth</span></div>
        <Field label="Apelido da carteira" required value={f.nickname} onChange={set('nickname')} error={errors.nickname} />
        <div><p className="text-xs">Avatar</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="grid size-12 place-items-center overflow-hidden rounded-full bg-surface">{avatar ? <img src={avatar} alt="Avatar atual" className="size-full object-cover" /> : <span aria-hidden>👤</span>}</div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Escolher avatar" onChange={pick} />
            <Button type="button" onClick={() => fileRef.current?.click()}>Alterar</Button>
            <button type="button" className="text-xs hover:text-brand" onClick={() => setAvatar(null)} disabled={!avatar}>Remover</button></div>
          <p role="alert" className="mt-1 text-[11px] text-red-300">{errors.avatar}</p></div>
      </div>
      <h2 className="mb-3 mt-4 font-bold">Alterar senha</h2>
      <div className="max-w-md">
        <PasswordField label="Senha atual" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={errors.currentPassword} />
        <PasswordField label="Nova senha" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} error={errors.newPassword} />
        <PasswordField label="Confirmar nova senha" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={errors.confirmPassword} />
      </div>
      <p role="status" className="mb-2 text-xs text-secondary">{status}</p>
      <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
    </form>
  )
}
export function ProfileData() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile })
  if (profile.isPending) return <div className="space-y-4" aria-busy><Skeleton className="h-8 w-1/3" /><Skeleton className="h-64" /></div>
  if (profile.isError) return <div role="alert">Falha ao carregar o perfil. <Button variant="outline" onClick={() => profile.refetch()}>Tentar novamente</Button></div>
  return <ProfileForm initial={profile.data} />
}

// ---------- Carteiras
const toForm = (w: Wallet): WalletForm => ({ displayName: w.displayName, nickname: w.label, network: w.network, profileName: w.profileName, walletAddress: w.address, secondary: w.secondary, walletType: w.walletType, referralCode: w.referralCode, email: w.email, ens: w.ens })

function WalletFormView({ initial, submitLabel, onSave, onCancel }: { initial: WalletForm; submitLabel: string; onSave: (f: WalletForm) => Promise<unknown>; onCancel?: () => void }) {
  const [f, setF] = useState(initial); const [errors, setErrors] = useState<Record<string, string>>({}); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k: keyof WalletForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }))
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setStatus(''); const v = validateWallet(f); setErrors(v); if (Object.keys(v).length) return
    setBusy(true)
    try { await onSave(f); setStatus('Carteira salva.') } catch (err) { const b = errorBody(err); setErrors(b?.fields ?? {}); setStatus(b?.fields ? '' : errorMessage(err)) } finally { setBusy(false) }
  }
  return (
    <form noValidate onSubmit={submit}>
      <div className="grid gap-x-6 md:grid-cols-2">
        <Field label="Nome de exibição" required value={f.displayName} onChange={set('displayName')} error={errors.displayName} />
        <Field label="Apelido da carteira" required value={f.nickname} onChange={set('nickname')} error={errors.nickname} />
        <SelectField label="Rede" required value={f.network} onChange={set('network')} error={errors.network}><option value="">Selecione uma rede</option>{NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</SelectField>
        <Field label="Nome do perfil" required value={f.profileName} onChange={set('profileName')} error={errors.profileName} />
        <Field label="Endereço da carteira" required placeholder="Endereço 0x da carteira" value={f.walletAddress} onChange={set('walletAddress')} error={errors.walletAddress} />
        <Field label="Carteira secundária" placeholder="ENS ou carteira secundária (opcional)" value={f.secondary} onChange={set('secondary')} error={errors.secondary} />
        <SelectField label="Tipo de carteira" required value={f.walletType} onChange={set('walletType')} error={errors.walletType}><option value="">Selecione uma carteira</option>{WALLET_TYPES.map((w) => <option key={w}>{w}</option>)}</SelectField>
        <Field label="Código de indicação" required value={f.referralCode} onChange={set('referralCode')} error={errors.referralCode} />
        <Field label="E-mail" type="email" required value={f.email} onChange={set('email')} error={errors.email} />
        <div className="flex items-start gap-2"><Field className="grow" label="Nome ENS" required value={f.ens} onChange={set('ens')} error={errors.ens} /><span className="mt-6 text-xs text-secondary">.eth</span></div>
      </div>
      <p role="status" className="mb-2 text-xs text-secondary">{status}</p>
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : submitLabel}</Button>{onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>}</div>
    </form>
  )
}

export function WalletsPage() {
  const qc = useQueryClient(); const { data: user } = useQuery(sessionQuery)
  const wallets = useQuery({ queryKey: ['wallets', user?.id], queryFn: api.wallets, enabled: !!user })
  const [adding, setAdding] = useState(false); const [editing, setEditing] = useState(false); const [same, setSame] = useState(false); const [removeErr, setRemoveErr] = useState('')
  const inv = () => qc.invalidateQueries({ queryKey: ['wallets'] })
  const remove = useMutation({ mutationFn: (id: string) => api.deleteWallet(id), onSuccess: () => { setRemoveErr(''); inv() }, onError: (e) => setRemoveErr(errorMessage(e)) })
  if (wallets.isPending) return <div className="space-y-4" aria-busy><Skeleton className="h-8 w-1/3" /><Skeleton className="h-72" /></div>
  if (wallets.isError) return <div role="alert">Falha ao carregar as carteiras. <Button variant="outline" onClick={() => wallets.refetch()}>Tentar novamente</Button></div>
  const primary = wallets.data.find((w) => w.primary); const secondary = wallets.data.find((w) => !w.primary)
  return (
    <div className="space-y-10">
      <section aria-labelledby="wp"><h1 id="wp" className="font-bold">Carteira principal</h1><p className="mb-4 text-[11px] text-secondary">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
        <WalletFormView key={primary?.id ?? 'new'} initial={primary ? toForm(primary) : EMPTY_WALLET} submitLabel="Salvar carteira" onSave={async (f) => { await (primary ? api.updateWallet(primary.id, f) : api.createWallet({ ...f, primary: true })); await inv() }} /></section>
      <section aria-labelledby="ws"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="ws" className="font-bold">Carteira secundária</h2>
        {!secondary && !adding && <div className="flex items-center gap-3 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={same} disabled={!primary} onChange={(e) => setSame(e.target.checked)} />Igual à carteira principal</label><button type="button" className="text-brand hover:underline" onClick={() => setAdding(true)}>Adicionar</button></div>}</div>
        {secondary && !editing && <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md bg-surface p-4 text-xs"><div className="grow"><p className="font-bold">{secondary.label}</p><p className="text-secondary">{secondary.walletType} · {NETWORKS.find((n) => n.id === secondary.network)?.label} · {secondary.address.slice(0, 8)}…{secondary.address.slice(-4)}</p></div>
          <Button variant="outline" onClick={() => setEditing(true)}>Editar</Button><Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate(secondary.id)}>Remover</Button></div>}
        <p role="alert" className="mt-2 text-xs text-red-300">{removeErr}</p>
        {!secondary && !adding && <p className="mt-2 text-[11px] text-secondary">Você ainda não adicionou uma carteira secundária.</p>}
        {!secondary && adding && <div className="mt-4"><WalletFormView initial={same && primary ? { ...toForm(primary), walletAddress: '', nickname: '' } : EMPTY_WALLET} submitLabel="Salvar carteira" onCancel={() => setAdding(false)} onSave={async (f) => { await api.createWallet({ ...f, primary: false }); setAdding(false); await inv() }} /></div>}
        {secondary && editing && <div className="mt-4"><WalletFormView initial={toForm(secondary)} submitLabel="Salvar carteira" onCancel={() => setEditing(false)} onSave={async (f) => { await api.updateWallet(secondary.id, f); setEditing(false); await inv() }} /></div>}
      </section>
    </div>
  )
}

// ---------- Lista de interesse
export function FavoritesPage() {
  const { data: user } = useQuery(sessionQuery)
  const ids = useQuery({ queryKey: ['favorites', user?.id], queryFn: api.favorites, enabled: !!user })
  const items = useQueries({ queries: (ids.data ?? []).map((id) => ({ queryKey: ['nft', id], queryFn: ({ signal }: { signal: AbortSignal }) => api.nft(id, signal) })) })
  if (ids.isPending) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy>{Array.from({ length: 3 }, (_, i) => <NftCardSkeleton key={i} />)}</div>
  if (ids.isError) return <div role="alert">Falha ao carregar a lista. <Button variant="outline" onClick={() => ids.refetch()}>Tentar novamente</Button></div>
  return (
    <section aria-labelledby="fv"><h1 id="fv" className="mb-4 font-bold">Lista de interesse</h1>
      {ids.data.length === 0 ? <p className="text-secondary">Você ainda não favoritou nenhum NFT. <Link to="/" search={{ page: 1 }} className="text-brand underline">Explorar NFTs</Link></p>
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((q, i) => q.data ? <NftCard key={q.data.id} nft={q.data} /> : <NftCardSkeleton key={ids.data[i]} />)}</div>}
    </section>
  )
}
