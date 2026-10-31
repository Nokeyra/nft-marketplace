import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard, PasswordField } from '../components/auth'
import { Field } from '../components/field'
import { Button } from '../components/ui/button'
import { api, errorBody, errorMessage, TOKEN_KEY } from '../lib/api'

export function RegisterPage() {
  const { redirect: back } = useSearch({ strict: false }) as { redirect?: string }
  const qc = useQueryClient(); const nav = useNavigate()
  const [errors, setErrors] = useState<Record<string, string>>({}); const [formError, setFormError] = useState('')
  const m = useMutation({
    mutationFn: (v: { name: string; email: string; password: string }) => api.register(v),
    onSuccess: ({ token, user }) => { qc.clear(); localStorage.setItem(TOKEN_KEY, token); qc.setQueryData(['session'], user); nav({ to: back ?? '/' }) },
    onError: (e) => { const b = errorBody(e); setErrors(b?.fields ?? {}); setFormError(b?.fields ? '' : errorMessage(e)) }, // conflito/validação vindos da API
  })
  const submit = (f: FormData) => {
    const v = { name: String(f.get('name')), email: String(f.get('email')), password: String(f.get('password')) }; const e: Record<string, string> = {}
    if (v.name.trim().length < 3) e.name = 'Informe o nome de usuário (mín. 3 caracteres)'
    if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'E-mail inválido'
    if (v.password.length < 8) e.password = 'A senha precisa ter ao menos 8 caracteres'
    if (String(f.get('confirm')) !== v.password) e.confirm = 'As senhas não coincidem'
    setErrors(e); setFormError(''); if (!Object.keys(e).length) m.mutate(v)
  }
  return (
    <AuthCard mode="register" back={back} subtitle="Crie seu perfil de colecionador e conecte uma carteira quando quiser.">
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)) }}>
        <Field label="Nome de usuário" name="name" autoComplete="username" placeholder="Nome de usuário" error={errors.name} />
        <Field label="E-mail" name="email" type="email" autoComplete="email" placeholder="Digite seu e-mail" error={errors.email} />
        <PasswordField label="Senha" name="password" autoComplete="new-password" placeholder="Senha" error={errors.password} />
        <PasswordField label="Confirmar senha" name="confirm" autoComplete="new-password" placeholder="Confirmar senha" error={errors.confirm} />
        <p role="alert" className="text-xs text-red-300">{formError}</p>
        <Button type="submit" disabled={m.isPending} className="mt-2 w-full">{m.isPending ? 'Criando conta…' : 'Criar conta'}</Button>
      </form>
    </AuthCard>
  )
}
