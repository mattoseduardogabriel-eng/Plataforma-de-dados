# Integração com o Liro CRM

Este produto faz parte do hub da Órbita, que unifica o Liro CRM, esta
plataforma e outros produtos futuros. A integração usa a **API externa do
Liro CRM** (server-to-server, sem login de usuário) para:

1. **Importar contatos do Liro CRM como Leads** (e já como Negócio no
   Funil de Vendas) — sincronização incremental, casando por telefone
   para não duplicar.
2. **Sincronizar o funil de vendas nos dois sentidos, em tempo real** —
   mover um negócio numa etapa mapeada reflete no Kanban do Liro, e
   arrastar uma conversa lá reflete de volta aqui.
3. **Devolver resultados como tags no Liro** — toda decisão do **Crivo**
   (aprovado/reprovado/análise manual) e o envio manual de tags a partir de
   um lead aplicam uma tag no contato correspondente do Liro, para o
   atendente ver o resultado sem sair de lá.
4. **Abrir a conversa do cliente no Liro direto daqui** — clicar no
   telefone de um lead ou cliente abre o painel do Liro já na conversa
   certa.

## Como conectar

Em **Configurações → Integrações**, um administrador ou gestor:

1. Gera uma chave em **Liro CRM → Configurações → API pra integração
   externa** (`liro_<id>_<segredo>`, só aparece uma vez).
2. Cola a chave e a Base URL (`https://<domínio-do-liro>/api/external/v1`)
   na Plataforma e clica em **Conectar** — a chave é validada contra a API
   real antes de ser salva.

A chave é cifrada (AES-256-GCM) antes de ir para o banco — ver
`backend/src/common/crypto/secret-cipher.ts`. Nunca é exposta de volta ao
frontend; a UI mostra só os últimos 4 caracteres.

Ao conectar, a Plataforma também **se auto-registra como webhook** no
Liro (`POST /webhooks`, eventos `conversation_moved` e
`conversation_deleted`) — não precisa cadastrar nada manualmente na tela
de Webhooks do Liro, só requer que a variável de ambiente
`PUBLIC_API_URL` (backend desta plataforma) esteja configurada com o
domínio público onde ela está hospedada; sem isso, o registro é pulado
(logado como aviso) e o resto da integração continua funcionando
normalmente, só sem o lado Liro → Aster em tempo real.

**Assinatura das entregas (HMAC-SHA256).** O registro devolve um
`signingSecret`, guardado cifrado (mesmo esquema da chave de API, ver
`Organization.liroWebhookSigningSecretEncrypted`). Toda entrega recebida
em `POST /api/integrations/liro-crm/webhook/:token` traz o header
`X-Liro-Signature: sha256=<hmac hex>`, calculado pelo Liro sobre o corpo
bruto da requisição — a Plataforma recalcula o mesmo HMAC (por isso
`main.ts` liga `rawBody: true`, pra comparar os bytes exatos assinados,
não o JSON reserializado) e rejeita a entrega se não bater
(`LiroCrmService.verifyWebhookSignature`). A verificação é tolerante de
propósito: sem segredo salvo ainda, ou sem o header (Liro desatualizado),
a entrega é aceita mesmo assim — só loga aviso — pra não quebrar quem já
estava funcionando antes desse recurso existir.

## O que a sincronização de contatos faz

`POST /api/integrations/liro-crm/sync` busca contatos alterados desde a
última sincronização (`GET /contacts?since=...`) e, para cada um:

- se já existe um Lead com o mesmo `liroContactId` ou telefone, atualiza;
- senão, cria um novo Lead com `source: "Liro CRM"`.

Em qualquer um dos dois casos, se o Lead ainda não tiver nenhum negócio
**aberto**, um é criado automaticamente na 1ª etapa do funil padrão da
organização — é assim que um contato sincronizado já aparece no **Funil
de Vendas** sem precisar cadastrar negociação manualmente.

Três jeitos de disparar essa sincronização:

1. **Sozinha, a cada 5 minutos** — `LiroCrmSyncScheduler`
   (`@nestjs/schedule`), roda pra toda organização conectada, isolado por
   organização (uma falhando não trava as outras).
2. **Botão "Sincronizar contatos agora"**, em Configurações → Integrações.
3. **Botão "Atualizar" no Funil de Vendas** — roda a mesma sincronização
   antes de recarregar a tela, sem precisar sair do funil.

O campo **"Última sincronização"** mostra quando a checagem rodou de
verdade pela última vez (`liroCrmLastSyncAttemptAt`), rodando ou não
vindo contato novo — não fica "parado" só porque não tinha nada novo pra
trazer daquela vez.

**Alerta de falha persistente.** `LiroCrmSyncScheduler` conta quantas
rodadas SEGUIDAS do sync automático falharam por organização
(`liroCrmSyncFailureCount`, zera a cada sucesso). Ao cruzar 5 rodadas
seguidas falhando (~25min de falha contínua — sinal de chave revogada ou
Liro fora do ar de vez, não instabilidade passageira isolada), grava uma
entrada em `AuditLog` (`LIRO_CRM_SYNC_REPEATED_FAILURE`) e a tela de
Integrações mostra um aviso vermelho com a última mensagem de erro
(`liroCrmLastSyncError`). O alerta só registra uma vez ao cruzar o
limite, não a cada rodada depois disso — volta a poder alertar só depois
do próximo sucesso.

## Sincronização de funil (bidirecional, tempo real)

Cada etapa do Funil de Vendas pode ser mapeada pra uma etapa do Kanban do
Liro, em **Configurações → Integrações → Liro CRM → Sincronização de
funil** — uma tabela lista as etapas daqui com um seletor das etapas
reais de lá (`GET /kanban-stages`). **Etapa sem mapeamento nunca reflete
em nenhuma direção.**

- **Aster → Liro**: mover um negócio (arrastar no Kanban, ou já na
  criação — "Nova negociação", "Adicionar ao Funil de Vendas" ou a
  sincronização de contatos) chama `PATCH /contacts/:id/kanban-stage` se
  a etapa de destino tiver mapeamento. Se o lead ainda não tiver
  `liroContactId`, o contato é achado/criado por telefone antes (mesmo
  helper do envio de tag). Se o contato não tiver conversa aberta no
  Liro, a API de lá responde `404` e nada acontece — **isso é esperado**:
  lead sem conversa aberta não deve mexer em nada por lá.
- **Liro → Aster**: quando alguém move um card no Kanban do Liro, o
  webhook `conversation_moved` chega em
  `POST /api/integrations/liro-crm/webhook/:token` (rota pública,
  autenticada só pelo token opaco da URL — nunca o id da organização).
  Acha o lead pelo contato, o negócio aberto mais recente dele, e move
  pra etapa mapeada **direto no banco**, sem passar pelo fluxo normal de
  mover — assim não dispara de volta um push pro Liro (senão vira
  ping-pong infinito entre os dois lados).
- **Conversa excluída no Liro**: o webhook `conversation_deleted` remove
  o(s) negócio(s) aberto(s) do lead correspondente — o **Lead continua
  existindo normalmente**, só sai do Funil de Vendas. Pra recolocá-lo
  quando quiser, o botão **"Adicionar ao Funil de Vendas"** no detalhe do
  lead (só aparece quando ele não tem negócio aberto) cria um negócio
  novo na 1ª etapa.

Botão "Atualizar" no Funil de Vendas e no Fluxos de trabalho do Liro:
recarregam a tela na hora, sem esperar o próximo ciclo automático —
útil quando você quer conferir na hora se um movimento já refletiu do
outro lado.

## Como o telefone é casado entre os dois sistemas

A mesma pessoa salva de formas diferentes (com/sem `+55`, com/sem o 9º
dígito, com parênteses/traço) não deve virar dois leads/contatos
diferentes. Os dois sistemas normalizam telefone pro mesmo padrão —
`55` + DDD (2 dígitos) + número (9 dígitos, inserindo o 9º
automaticamente quando falta, distinguindo celular de fixo pelo primeiro
dígito depois do DDD) — antes de gravar ou comparar:

- Do lado do Liro: `liro-backend/src/utils/phone.js`, aplicado em toda
  mensagem recebida do WhatsApp, cadastro manual de contato, importação
  de planilha e no `POST /contacts` da própria API externa.
- Do lado daqui: `backend/src/common/utils/phone.util.ts`, aplicado na
  sincronização de contatos, no webhook recebido do Liro e na criação de
  negócio com telefone digitado na hora.

Isso só vale **daqui pra frente** — um lead/contato que já ficou
duplicado antes dessa normalização existir continua separado até alguém
limpar manualmente (excluir um dos dois); o casamento automático só roda
de novo quando o registro é tocado (uma nova mensagem, uma sincronização
que o traz de volta, etc).

## Como as tags voltam para o Liro

- **Automático**: toda vez que o Crivo avalia um documento que corresponde
  a um Lead na base, uma tag `Crivo: APROVADO` / `Crivo: REPROVADO` /
  `Crivo: ANALISE MANUAL` é aplicada no contato do Liro — melhor esforço,
  nunca quebra a avaliação se a integração não estiver configurada ou
  falhar (`LiroCrmService.tryTagByDocument`).
- **Manual**: na tela de um Lead, o card "Enviar tag ao Liro CRM" aplica
  qualquer tag digitada. Se o lead ainda não tem um contato vinculado no
  Liro (`liroContactId`), ele é criado automaticamente por telefone
  (`POST /contacts`, upsert) antes de aplicar a tag.

## Abrir a conversa no Liro direto daqui

Clicar no telefone de um lead (tela de detalhe do Lead) ou de um cliente
(Pós-venda) copia o telefone e abre o painel do Liro (`/painel`) numa
janela reaproveitada (não abre aba nova a cada clique) com `?phone=` na
URL — o Liro usa isso pra abrir a conversa certa direto, sem precisar
colar na busca manualmente (`liro-frontend/src/lib/... ver
openLiroCrmConversation` no lado daqui e o tratamento de `?phone=` em
`Dashboard.jsx` do lado do Liro).

## Endpoints usados (ver `liro-crm.connector.ts`)

| Liro CRM | Uso aqui |
|---|---|
| `GET /tags` | Testar conexão (`POST /integrations/liro-crm/test`) |
| `GET /contacts?since=` | Sincronização de leads |
| `POST /contacts` | Criar/atualizar contato ao vincular um lead sem `liroContactId` |
| `POST /contacts/:id/tags` | Espelhar decisão do Crivo / tag manual |
| `GET /kanban-stages` | Montar a tela de mapeamento de funil |
| `PATCH /contacts/:id/kanban-stage` | Refletir negócio movido (Aster → Liro) |
| `POST /webhooks` | Auto-registro pra receber `conversation_moved`/`conversation_deleted` |

## Auditoria

Toda ação (salvar/remover credenciais, sincronizar, aplicar tag, mover
etapa vinda do Liro, negócio removido do funil por exclusão de conversa)
gera um `AuditLog` (`LIRO_CRM_CREDENTIALS_SAVED`,
`LIRO_CRM_SYNC_CONTACTS`, `LIRO_CRM_TAG_PUSHED`,
`LIRO_CRM_STAGE_SYNCED_FROM_LIRO`, `LIRO_CRM_DEAL_REMOVED_FROM_FUNNEL`,
...), visível em **Auditoria (LGPD)**.

## Testando localmente sem uma conta real no Liro

O contrato da API é simples o bastante para simular com um mock HTTP local
implementando `GET /tags`, `GET/POST /contacts`, `POST /contacts/:id/tags`,
`GET /kanban-stages`, `PATCH /contacts/:id/kanban-stage` e `POST /webhooks`
com o mesmo formato de autenticação e erros — é assim que esta integração
foi validada ponta a ponta durante o desenvolvimento (conectar,
sincronizar, mapear funil, mover negócio nos dois sentidos, avaliar no
Crivo e ver a tag aparecer no contato).
