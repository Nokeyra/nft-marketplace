import { useState } from 'react'
import { Button } from './ui/button'

const COLS: [string, string[]][] = [['Meu perfil', ['Meu perfil', 'Minha coleção', 'Atividade']], ['Central de ajuda', ['Como comprar NFTs', 'Carteira e segurança', 'Política do mercado']], ['Coleções', ['Cosmic Drift', 'Pixel Pets', 'Neon Skies', 'Abstract Minds']]]
const VALUE: [string, string, string][] = [['W', 'Segurança da carteira', 'Proteja sua carteira e colecione arte digital verificada com confiança.'], ['C', 'Criadores em destaque', 'Conheça artistas, estúdios e comunidades que moldam a cultura digital.'], ['D', 'Alertas de lançamentos', 'Receba calendários de cunhagem, novidades de listas de acesso e análises.']]

export function Footer() {
  const [sent, setSent] = useState(false); const [err, setErr] = useState('')
  return (
    <footer className="mx-auto mt-16 w-full max-w-[1280px] rounded-lg bg-surface">
      <div className="grid gap-6 p-8 md:grid-cols-4">
        {VALUE.map(([k, t, d]) => <div key={t} className="border-brand md:border-r md:pr-6"><span aria-hidden className="mb-3 grid size-10 place-items-center rounded-full bg-brand font-bold text-ink">{k}</span><h2 className="font-bold">{t}</h2><p className="mt-2 text-xs text-secondary">{d}</p></div>)}
        <form noValidate onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get('email')); if (/^\S+@\S+\.\S+$/.test(v)) { setSent(true); setErr('') } else setErr('E-mail inválido') }}>
          <h2 className="font-bold">Antecipe-se ao próximo lançamento</h2>
          <div className="mt-3 flex"><label className="grow"><span className="sr-only">E-mail</span><input name="email" placeholder="digite seu e-mail..." className="w-full border border-line bg-ink px-3 py-2 text-xs" /></label><Button type="submit" className="rounded-l-none">Enviar</Button></div>
          <p role="status" className="mt-2 text-xs text-secondary">{sent ? 'Obrigado! Você receberá as novidades.' : ''}</p><p role="alert" className="text-xs text-red-300">{err}</p>
        </form>
      </div>
      <div className="flex flex-wrap justify-between gap-4 bg-surface-dark px-8 py-5 text-xs"><strong>KURIO</strong><span>Feito para colecionadores, criadores e cultura</span><span>contato@email.com</span><span>+55 11 4002 8922</span></div>
      <nav aria-label="Rodapé" className="grid gap-6 p-8 sm:grid-cols-3">{COLS.map(([h, items]) => <div key={h}><h2 className="mb-2 font-bold">{h}</h2><ul className="space-y-1 text-xs text-muted">{items.map((i) => <li key={i}>{i}</li>)}</ul></div>)}</nav>
      <p className="pb-6 text-center text-xs text-muted">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
