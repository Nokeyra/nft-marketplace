# Arquitetura e decisões

- **Mocks na rede:** handlers MSW (`src/mocks`) com banco em memória persistido em localStorage; nenhum mock em componentes/hooks/Axios.
- **Socket.IO:** `ws.link('*/socket.io/')` + `@mswjs/socket.io-binding`; o app usa `socket.io-client` real (`src/lib/realtime.ts`). Limitação: sem rooms/namespaces/broadcast nativos; broadcast é feito iterando conexões abertas. Eventos de sessão anterior: o socket é recriado por usuário e o cache é limpo no logout.
- **Cache:** `staleTime` 30s, 2 retries, `placeholderData` na paginação, cancelamento via `AbortSignal`; chaves por parâmetros (`['nfts', search]`) e por usuário (`['cart', userId]`).
- **Reconciliação:** eventos deduplicados por `id` e aplicados só se `version` for maior; em `connect` todas as queries ativas são invalidadas.
- **ETH:** strings decimais, cálculo em bigint/wei (`src/lib/eth.ts`).

- **Pedidos:** `POST /api/orders` exige `Idempotency-Key`. Mesma chave + mesmo conteúdo devolve o mesmo pedido; conteúdo diferente gera 409. O servidor revalida estoque e total (`QUOTE_CHANGED`/`STOCK_CONFLICT` devolvem a cotação nova) e só então cria o pedido `pending`; o desfecho sai ~2,5s depois por `order.updated`. Se a página recarregar, o `GET` do pedido conclui o que venceu o prazo. Estoque e carrinho só mudam na confirmação, e só para os itens/quantidades comprados.
- **Conta:** `POST /api/auth/register` valida campos (422 com `fields`) e devolve 409 `EMAIL_TAKEN` em conflito; senhas guardadas só como hash SHA-256 nos mocks. Favoritos: `GET/PUT/DELETE /api/favorites`, por usuário, com atualização otimista e rollback no detalhe.
- **Perfil e carteiras:** `PUT /api/profile` (nome, usuário único, e-mail único, ENS, avatar até 150 KB e troca de senha com conferência da senha atual); carteiras com uma principal e no máximo uma secundária (`POST/PUT/DELETE /api/wallets`), endereço duplicado e remoção da principal recusados. Endereço alterado exige nova conexão. Menu lateral: itens sem tela (Atividade, Ofertas, Arquivos baixados, Suporte) ficam desabilitados.
- **Checkout:** a UI guarda o total aceito na revisão; se a cotação mudar, o botão de confirmar fica desabilitado até o usuário aceitar os novos valores. A chave de idempotência é regenerada apenas quando o conteúdo muda.

## Desvios e limitações conhecidos
- Visual: tokens do Figma (cores, Roboto Mono) aplicados via `@theme` em `src/index.css`. Telas conferidas com o Figma: Desktop Início, Detalhes, Carrinho, Pagamento, Confirmação, Login e Cadastro. Perfil e Carteiras também foram implementados a partir do Figma. Mobile (390 px): Início, Detalhe e Carrinho seguem o Figma (barra inferior, barra de compra fixa, resumo preso no rodapé); no Pagamento mobile o Figma mostra só a escolha de carteira, mas mantive o formulário completo (campos obrigatórios) abaixo, por causa da validação exigida. Login/Cadastro/Confirmação mobile reaproveitam o cartão responsivo, sem conferência pixel a pixel. O botão central de escaneamento da barra inferior foi omitido (sem função). Tablet (768 px) usa o layout intermediário.
- Login e Cadastro são páginas com cartão e abas (no Figma aparecem como modal sobre o Início); botões "Continuar com Google/Facebook" ficam desabilitados e "Esqueceu a senha?" só informa que é simulado. A confirmação também é uma página (painel), não um modal.
- As regras do formulário de pagamento vivem em `src/lib/validate.ts` e são aplicadas na UI e revalidadas pelo handler `POST /api/orders` (422 com `fields`).
- Imagens dos NFTs são placeholders (picsum), pois os assets do Figma não puderam ser baixados neste ambiente. Omitidos por falta de dado na API: filtro de Rede, avaliações e seletor de edição. "Criadores" e "Aprenda" aparecem desabilitados.
- Carrinho exige login (sem carrinho de visitante).
- Testes E2E (incluindo checkout) escritos, mas não executados no ambiente de geração (Chromium indisponível). O checkout foi validado apenas por typecheck e build; falta testá-lo no navegador.
- Pedido com timeout usa 9s de atraso contra 8s do Axios; o retry reaproveita a chave, mas não há botão dedicado de reenvio além de "Confirmar compra".
- Cobertura dos itens 1 a 12 de testes é parcial; Lighthouse e deploy não feitos.
