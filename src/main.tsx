import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { makeRouter } from './routes/router'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: true } } })
const router = makeRouter(qc)

async function boot() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const sc = new URLSearchParams(location.search).get('scenario') // ?scenario=slow seleciona; ?scenario=default limpa
    if (sc === 'default') localStorage.removeItem('mock-scenario')
    else if (sc) localStorage.setItem('mock-scenario', sc)
    const { worker } = await import('./mocks/browser')
    await worker.start()
    if (new URLSearchParams(location.search).has('reset')) { await fetch('/api/__mock/reset', { method: 'POST' }); localStorage.removeItem('session-token') }
  }
  createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider></StrictMode>)
}
void boot()
