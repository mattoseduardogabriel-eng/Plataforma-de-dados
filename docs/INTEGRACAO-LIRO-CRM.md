# Integração com o Liro CRM

Este produto faz parte do hub da Órbita, que unifica o Liro CRM, esta
plataforma e outros produtos futuros. A integração usa a **API externa do
Liro CRM** (server-to-server, sem login de usuário) para:

1. **Importar contatos do Liro CRM como Leads** — sincronização incremental
   (via `since`), casando por telefone para não duplicar.
2. **Devolver resultados como tags no Liro** — toda decisão do **Crivo**
   (aprovado/reprovado/análise manual) e o envio manual de tags a partir de
   um lead aplicam uma tag no contato correspondente do Liro, para o
   atendente ver o resultado sem sair de lá.

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

## O que a sincronização faz

`POST /api/integrations/liro-crm/sync` busca contatos alterados desde a
última sincronização (`GET /contacts?since=...`) e, para cada um:

- se já existe um Lead com o mesmo `liroContactId` ou telefone, atualiza;
- senão, cria um novo Lead com `source: "Liro CRM"`.

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

## Endpoints usados (ver `liro-crm.connector.ts`)

| Liro CRM | Uso aqui |
|---|---|
| `GET /tags` | Testar conexão (`POST /integrations/liro-crm/test`) |
| `GET /contacts?since=` | Sincronização de leads |
| `POST /contacts` | Criar/atualizar contato ao vincular um lead sem `liroContactId` |
| `POST /contacts/:id/tags` | Espelhar decisão do Crivo / tag manual |

## Auditoria

Toda ação (salvar/remover credenciais, sincronizar, aplicar tag) gera um
`AuditLog` (`LIRO_CRM_CREDENTIALS_SAVED`, `LIRO_CRM_SYNC_CONTACTS`,
`LIRO_CRM_TAG_PUSHED`, ...), visível em **Auditoria (LGPD)**.

## Testando localmente sem uma conta real no Liro

O contrato da API é simples o bastante para simular com um mock HTTP local
implementando `GET /tags`, `GET/POST /contacts`, `POST /contacts/:id/tags`
com o mesmo formato de autenticação e erros — é assim que esta integração
foi validada ponta a ponta durante o desenvolvimento (conectar, sincronizar,
avaliar no Crivo e ver a tag aparecer no contato).
