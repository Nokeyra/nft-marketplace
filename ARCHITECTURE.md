# Arquitetura e decisões

## Camadas

- **UI:** React + TanStack Router (rotas em código, `validateSearch` para estado de busca na URL). Componentes base no padrão shadcn/ui (`cva`, Radix `Slot`, `tailwind-merge`). Tokens do Figma em `@theme` (`src/index.css`).
- **Dados:** TanStack Query sobre um cliente Axios (`src/lib/api.ts`) sem nenhuma resposta fictícia.
- **Mocks:** MSW 2 na camada de rede (`src/mocks`): handlers REST e `ws.link` com `@mswjs/socket.io-binding`. Estado em memória, persistido em `localStorage` (`mock-db-v4`). Ativados por `VITE_ENABLE_MOCKS`.

## Contratos REST

Erros: corpo `{ code, message, fields?, cart? }`. ETH trafega como string decimal; cálculos em bigint/wei (`src/lib/eth.ts`).

| Método e rota | Sucesso | Erros |
| --- | --- | --- |
| `POST /api/auth/login` `{email,password}` | 200 `{token,user}` | 401 `INVALID_CREDENTIALS` |
| `POST /api/auth/register` `{name,email,password}` | 201 `{token,user}` | 422 `VALIDATION` (`fields`), 409 `EMAIL_TAKEN` |
| `GET /api/auth/session` · `POST /api/auth/logout` | 200 `User` · 204 | 401 `SESSION_INVALID` |
| `GET /api/nfts?q&collection&sort&minPrice&maxPrice&page&pageSize` (`sort`: `price-asc`, `price-desc`, `name`, `newest`, `trending`; `pageSize` padrão 9, máx. 24) | 200 `{items,total,page,pageSize}` | — |
| `GET /api/nfts/:id` | 200 `Nft` | 404 `NOT_FOUND` |
| `GET /api/cart` | 200 `Cart` | 401 |
| `PUT /api/cart/items/:id` `{qty}` · `DELETE /api/cart/items/:id` | 200 `Cart` | 409 `STOCK_CONFLICT`, 422, 404 |
| `PUT /api/cart/coupon` `{code}` | 200 `Cart` | 422 `COUPON_INVALID`, 410 `COUPON_EXPIRED` |
| `GET /api/favorites` · `PUT/DELETE /api/favorites/:id` | 200 `string[]` | 404, 500 (cenário `favorite-fail`) |
| `GET /api/profile` · `PUT /api/profile` | 200 `Profile` | 422 (`fields`, inclui senha atual incorreta), 409 `USERNAME_TAKEN`/`EMAIL_TAKEN` |
| `GET /api/wallets` · `POST /api/wallets` · `PUT/DELETE /api/wallets/:id` | 200/201 `Wallet` · 204 | 422, 409 `WALLET_LIMIT`/`WALLET_DUPLICATE`/`WALLET_PRIMARY` |
| `POST /api/wallets/:id/connect` · `/disconnect` | 200 `Wallet` | 403 `WALLET_REJECTED` (cenário `wallet-refuse`) |
| `POST /api/orders` (cabeçalho `Idempotency-Key`; corpo: `quoteTotal`, `walletId` e os campos do formulário de pagamento) | 201 `Order` pendente (200 com o mesmo pedido em reenvio) | 422 `VALIDATION`, 409 `QUOTE_CHANGED`/`STOCK_CONFLICT` (com `cart`), 409 `WALLET_NOT_CONNECTED`, 409 `IDEMPOTENCY_CONFLICT` |
| `GET /api/orders/pending` · `GET /api/orders/:id` | 200 `Order` (ou `null`) | 403 `FORBIDDEN`, 404 |
| `POST /api/__mock/nft/:id` `{priceEth?,stock?,duplicate?}` · `POST /api/__mock/reset` | evento emitido · 204 | só existem nos mocks |

## Eventos Socket.IO

Transporte `websocket`, `path: /socket.io`. Todo evento tem `id` estável, `resource`, `resourceId` e `version`.

| Evento | Payload | Efeito no cliente |
| --- | --- | --- |
| `nft.updated` | `{id,type,resource:'nft',resourceId,version,data:{priceEth,stock}}` | Atualiza detalhe e todas as listas em cache; invalida o carrinho (recalculado pela API) |
| `order.updated` | `{id,type,resource:'order',resourceId,userId,version,data:{status,txHash,reason}}` | Atualiza o pedido e exibe confirmação ou recusa; invalida o carrinho |

Mudanças simuladas (ex.: confirmação de pedido) alteram o banco e emitem o evento correspondente; o REST reflete o mesmo estado.

**Limitações do transporte simulado:** o `@mswjs/socket.io-binding` cobre eventos e acks, mas não rooms, namespaces nem broadcast nativos; o broadcast é feito iterando as conexões abertas (`src/mocks/handlers.ts`). Só há transporte `websocket` (sem polling) e não há reconexão com perda de eventos reais.

## Sessão

Token opaco em `localStorage` (`session-token`), enviado como `Authorization: Bearer`. Rotas protegidas redirecionam para `/login?redirect=` (`beforeLoad`). Um 401 em qualquer chamada limpa o token, esvazia o cache do Query e leva ao login com retorno à rota. O logout limpa o cache, para não expor dados do usuário anterior; o socket é recriado por usuário.

## Carrinho

Servidor é a fonte de verdade (por usuário). Exige login (não há carrinho de visitante). Totais (subtotal, desconto, taxa de rede de 0,5% e total) são calculados no servidor em wei. Quantidade usa atualização otimista com rollback. Após a confirmação de um pedido, só as quantidades compradas saem do carrinho; em recusa o carrinho permanece.

## Cache e reconciliação

- `staleTime` 30 s, 2 tentativas, `placeholderData` na paginação, `AbortSignal` em busca e detalhe. Chaves: `['nfts', params]`, `['nft', id]`, `['cart', userId]`, `['order', id]`, `['favorites', userId]`.
- **REST × Socket.IO:** o evento só altera o cache se `version` for maior que a do item (eventos antigos não regridem); `id` já visto é ignorado (duplicatas); eventos de `order.updated` de outro usuário são ignorados. Em `connect`/reconexão todas as queries ativas são invalidadas, para reconciliar com o REST. Na tela do pedido pendente há ainda polling de 2 s como reserva.
- **Pedidos:** `Idempotency-Key` por tentativa; mesma chave e mesmo conteúdo devolvem o mesmo pedido; conteúdo diferente gera 409. O servidor revalida estoque e total antes de criar. A UI guarda o total aceito na revisão e bloqueia a confirmação até o usuário aceitar novos valores. O pedido pendente é concluído ~2,5 s depois ou, após um refresh, na primeira leitura que o encontrar vencido.

## Decisões de UX

Skeletons com shimmer (respeitando `prefers-reduced-motion`), estados vazio e de erro com "Tentar novamente", mensagens de campo ligadas por `aria-describedby`/`role="alert"`, região `role="status"` para eventos em tempo real, busca/filtros/página na URL.

## Desvios do Figma e limitações

- Login, Cadastro e Confirmação são páginas com cartão/painel (no Figma aparecem como modal).
- Botões "Continuar com Google/Facebook" ficam desabilitados e "Esqueceu a senha?" apenas avisa que é simulado; "Ver no Etherscan" abre um link fictício. "Criadores", "Aprenda", Atividade, Ofertas, Arquivos baixados e Suporte ficam desabilitados (fora do escopo).
- Omitidos por falta de dado no contrato: filtro de Rede, avaliações, seletor de edição e o botão central de escaneamento do mobile.
- No pagamento mobile o Figma mostra só a escolha de carteira; mantive o formulário completo (validação exigida) abaixo dela.
- Mobile (390 px) conferido nas telas Início, Detalhe, Carrinho e Pagamento; Login/Cadastro/Confirmação reaproveitam o layout responsivo sem conferência pixel a pixel.
- Senhas são guardadas só como hash SHA-256 nos mocks (suficiente para simulação, não para produção).
- Regras de validação do formulário compartilham `src/lib/validate.ts` entre UI e mocks.
