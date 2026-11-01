# Kurio — Marketplace de NFTs (Desafio Frontend, Jungle Gaming)

React 19 + TypeScript + Vite, TanStack Router e Query, Axios, Socket.IO (`socket.io-client`), Tailwind v4, componentes no padrão shadcn/ui (cva + Radix Slot), MSW 2 (REST e WebSocket) e Playwright. Contratos e decisões em [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Setup

Requisitos: Node 20+ e npm.

```bash
npm install
npm run dev:mocks          # desenvolvimento com mocks (http://localhost:5173)
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` / `npm run dev:mocks` | Servidor de desenvolvimento (os mocks são ligados por `VITE_ENABLE_MOCKS`, ver abaixo) |
| `npm run build` | Verificação de tipos + build otimizado (mocks ativos, build de demonstração) |
| `npm run preview` | Serve o build em http://localhost:4173 |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint (typescript-eslint + react-hooks) |
| `npx playwright install chromium` | Instala o navegador dos testes (uma vez) |
| `npm run test:e2e` | Testes Playwright em 1440, 768 e 390 px (sobe build + preview sozinho) |
| `npm run test:e2e:update` | Gera/atualiza as imagens-base da regressão visual |
| `npm run lighthouse` | Auditoria Lighthouse (início e detalhe, mobile e desktop). Requer `npm run build && npm run preview` rodando em outro terminal; relatórios em `./lighthouse/` |

## Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` (arquivo `.env`) | Liga o MSW (REST + Socket.IO). Mantida ligada também no build publicado, que é a demonstração. |

## Credenciais fictícias

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Ana Colecionadora | `ana@demo.dev` | `demo1234` |
| Bruno Colecionador | `bruno@demo.dev` | `demo1234` |

Também é possível criar contas em `/register`. Cupons: `JUNGLE10` (10% de desconto) e `OLD2020` (expirado).

## Cenários e reset

O estado simulado fica no `localStorage` do navegador (chave `mock-db-v4`). Para restaurar o cenário conhecido, abra **`/?reset=1`** (recria o banco, limpa a sessão e zera a sequência de latências).

O cenário de rede/falha é escolhido por **`?scenario=<nome>`** na URL (fica gravado até `?scenario=default`) ou por `localStorage.setItem('mock-scenario', '<nome>')`:

| Cenário | Efeito | O que observar |
| --- | --- | --- |
| `default` | Latência de 150 ms, tudo funciona | — |
| `slow` | 2,5 s em toda chamada | Skeletons e botões em estado de carregamento |
| `jitter` | Latências fixas e alternadas (1200, 150, 800, 300, 1500, 100 ms) | Respostas fora de ordem: digite na busca; a UI mantém só a resposta da última consulta |
| `timeout` | 9 s por chamada (o Axios corta em 8 s) | Mensagem de erro e botão "Tentar novamente" |
| `error` | HTTP 503 em toda chamada | Feedback de erro e recuperação ao voltar a `default` |
| `error-4xx` | HTTP 429 | Idem, erro de cliente |
| `offline` | Falha de conexão (sem resposta) | Erro de rede |
| `session-expired` | Toda chamada autenticada responde 401 | Redirecionamento ao login com retorno à rota |
| `empty` | Catálogo sem itens | Estado vazio |
| `pay-declined` | Pedido termina recusado | Tela "Pedido recusado", itens permanecem no carrinho |
| `order-timeout` | Pedido é criado, mas a resposta demora 9 s | Erro de timeout; reenviar usa a mesma chave e **recupera o mesmo pedido** |
| `wallet-refuse` | Conexão de carteira recusada (403) | Mensagem no pagamento |
| `favorite-fail` | Favoritar falha (500) | Rollback da atualização otimista |

### Reproduzir os demais fluxos de falha

- **Cadastro com e-mail duplicado:** em `/register`, use `ana@demo.dev` (409 `EMAIL_TAKEN`). Campos vazios ou senha curta geram 422/validação.
- **Cupom inválido ou expirado:** no carrinho, aplique `QUALQUER` (422) ou `OLD2020` (410).
- **Preço alterado ou edição esgotada durante a compra:** com o pagamento em revisão, no Console: `fetch('/api/__mock/nft/2', { method: 'POST', body: JSON.stringify({ priceEth: '9.5' }) })` (ou `{ stock: 0 }`). O botão "Confirmar compra" trava até aceitar os novos valores; com estoque zerado o servidor responde 409 `STOCK_CONFLICT`.
- **Evento duplicado/antigo:** o mesmo comando com `duplicate: true` emite o evento duas vezes; o cliente aplica só uma.
- **Acesso não autorizado:** `/orders/<id de outro usuário>` responde 403.
- **Chave de idempotência reutilizada com conteúdo diferente:** 409 `IDEMPOTENCY_CONFLICT` (a UI gera nova chave sempre que o conteúdo muda; para ver o erro, repita um `POST /api/orders` manualmente com o mesmo `Idempotency-Key`).

## Fixtures

- **Catálogo:** 36 NFTs (ids 1–36) em 4 coleções (Cosmic Drift, Pixel Pets, Neon Skies, Abstract Minds), preços de 0,10 a 8,99 ETH, 9 por página (4 páginas), com 6 edições esgotadas (ids 1, 8, 15, 22, 29, 36). Exercita busca, coleção, faixa de preço, ordenação e paginação.
- **Usuários:** Ana (carteira principal e secundária) e Bruno (carteira principal), com perfil, e-mail e ENS de exemplo.
- **Imagens:** 4 artes em `public/nfts/` (`src/lib/images.ts`), reaproveitadas em rodízio.

## Lighthouse

Rode `npm run build && npm run preview` e, em outro terminal, `npm run lighthouse`. Os relatórios (HTML e JSON) ficam em `./lighthouse/`.

| Página | Perfil | Performance | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- |
| Início | Mobile | _a preencher após a execução_ | | | |
| Início | Desktop | | | | |
| Detalhe do NFT | Mobile | | | | |
| Detalhe do NFT | Desktop | | | | |

Resultados abaixo das metas e suas causas devem ser registradas aqui (a auditoria usa as imagens, fontes e funcionalidades reais, sem simplificações).

## Deploy

Vercel (Vite). `vercel.json` reescreve qualquer rota para `index.html`, então acesso direto e refresh funcionam. O build publicado usa os mocks (`VITE_ENABLE_MOCKS=true`).

## Estado da entrega

Implementado: catálogo, detalhe, carrinho (otimista, cupom, totais em wei), checkout idempotente (dados, carteira e rede, revisão, revalidação de cotação, confirmação/recusa, recibo), cadastro, login, sessão expirada, favoritos, perfil (dados, avatar, senha), carteiras (principal e secundária), `nft.updated` e `order.updated` via Socket.IO, layout responsivo (390/768/1440).
Limitações e desvios do Figma estão em `ARCHITECTURE.md`.
