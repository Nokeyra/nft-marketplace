# NFT Marketplace — Desafio Frontend (Jungle Gaming)

React + TypeScript + TanStack Router/Query + Axios + Socket.IO + Tailwind v4 + shadcn/ui (padrão cva/Slot) + MSW + Playwright.

## Setup
```bash
npm install
npm run dev:mocks      # desenvolvimento com mocks (MSW 2.x, exigido pelo socket.io-binding)
npm run typecheck
npm run build && npm run preview   # build de demonstração (mocks ativos), porta 4173
npx playwright install chromium && npm run test:e2e
```
Variável: `VITE_ENABLE_MOCKS=true` (padrão em `.env`, também no build de demonstração).

## Credenciais fictícias
`ana@demo.dev` / `bruno@demo.dev` — senha `demo1234` (comparada por hash SHA-256 nos mocks).

## Cenários e reset
- Reset total: abra `/?reset=1`.
- Cenário de rede: `localStorage.setItem('mock-scenario', 'slow' | 'jitter' | 'error' | 'offline' | 'empty')` e recarregue; remova a chave para voltar ao padrão.
- Checkout: `'pay-declined'` (pagamento recusado), `'order-timeout'` (pedido criado, resposta perdida; o retry com a mesma chave recupera o mesmo pedido), `'wallet-refuse'` (conexão de carteira recusada), `'favorite-fail'` (falha ao favoritar, para ver o rollback).
- Evento em tempo real: `fetch('/api/__mock/nft/2', { method: 'POST', body: JSON.stringify({ priceEth: '9.5', stock: 3 }) })` altera o estado simulado e emite `nft.updated` pelo socket.io-client.

## Status da entrega
Implementado: perfil (dados, avatar, senha), carteiras (principal e secundária), lista de interesse, cadastro (validação e conflito de e-mail), favoritos (otimista com rollback), checkout (dados, carteira/rede, revisão, revalidação, pedido idempotente pendente/confirmado/recusado, recibo com snapshot, recuperação após refresh, `order.updated`), catálogo (busca/coleção/ordenação/paginação na URL), detalhe, carrinho (quantidade otimista com rollback, remoção, cupom `JUNGLE10`/`OLD2020`), login/logout/expiração, `nft.updated` via Socket.IO, skeletons com shimmer.
**Pendente** (ver ARCHITECTURE.md): telas mobile conferidas com o Figma, histórico de pedidos, carrinho de visitante, destaques, fidelidade ao Figma nas telas restantes e no mobile, Lighthouse, regressão visual, deploy.
