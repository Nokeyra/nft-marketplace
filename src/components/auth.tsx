import { Link } from '@tanstack/react-router'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Field } from './field'

export function AuthCard({ mode, back, subtitle, children }: { mode: 'login' | 'register'; back?: string; subtitle: string; children: ReactNode }) {
  const tab = (on: boolean) => cn('transition hover:text-brand', on ? 'text-brand' : 'text-fg')
  return (
    <section className="relative mx-auto my-10 w-full max-w-sm rounded-md border-b-4 border-brand bg-surface p-6">
      <Link to="/" search={{ page: 1 }} aria-label="Fechar" className="absolute right-3 top-3 text-brand">×</Link>
      <nav aria-label="Acesso" className="flex items-center justify-center gap-3 text-base font-bold">
        <Link to="/login" search={{ redirect: back }} aria-current={mode === 'login' ? 'page' : undefined} className={tab(mode === 'login')}>Entrar</Link>
        <span aria-hidden className="h-4 w-px bg-brand" />
        <Link to="/register" search={{ redirect: back }} aria-current={mode === 'register' ? 'page' : undefined} className={tab(mode === 'register')}>Criar conta</Link>
      </nav>
      <p className="mx-auto mt-3 max-w-[260px] text-center text-[11px] text-secondary">{subtitle}</p>
      <div className="mt-4">{children}</div>
      <div className="mt-4 space-y-2 border-t border-line pt-3 text-center text-[11px] text-secondary"><p>Ou continue com</p>
        {['Google', 'Facebook'].map((n) => <button key={n} type="button" disabled title="Indisponível na simulação" className="w-full cursor-not-allowed rounded border border-line bg-ink px-3 py-2 text-xs text-muted opacity-70">Continuar com {n}</button>)}</div>
    </section>
  )
}

export function PasswordField({ label, error, ...p }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Field label={label} error={error} type={show ? 'text' : 'password'} {...p} />
      <button type="button" aria-pressed={show} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShow((v) => !v)} className="absolute right-2 top-[26px] text-xs text-secondary hover:text-brand">{show ? '🙈' : '👁'}</button>
    </div>
  )
}
