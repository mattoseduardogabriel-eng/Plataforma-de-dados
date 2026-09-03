# Arquitetura

## Visão geral

```
┌─────────────────┐        HTTPS/JSON        ┌──────────────────────┐
│   Frontend SPA   │ ───────────────────────▶ │   API (NestJS)       │
│  React + Vite    │ ◀─────────────────────── │  /api/*              │
│  (porta 5173)    │     JWT (Bearer) +       │  (porta 3001)        │
└─────────────────┘     refresh cookie        └──────────┬───────────┘
                                                          │ Prisma ORM
                                                          ▼
                                               ┌──────────────────────┐
                                               │   PostgreSQL 16      │
                                               └──────────────────────┘

API também fala com:
  • BrasilAPI (https://brasilapi.com.br)  → dado público oficial de CNPJ
  • [futuro] bureau de crédito licenciado → CPF / telefone / score / parentes
```

Dois projetos independentes (`/backend`, `/frontend`), cada um com seu próprio
`package.json`, orquestrados localmente via `docker-compose.yml`.

## Backend (`/backend`)

**Stack**: NestJS 10, TypeScript, Prisma ORM, PostgreSQL, Passport-JWT, class-validator,
Swagger.

**Autenticação**: JWT de acesso (15 min, enviado no header `Authorization: Bearer`) +
refresh token (7 dias, em cookie `httpOnly`, escopado a `/api/auth`). Logout e refresh
inválido incrementam `tokenVersion` no usuário, invalidando sessões antigas.

**Multi-tenant**: toda entidade de negócio carrega `organizationId`; nenhuma query cruza
organizações — o `organizationId` vem sempre do JWT do usuário autenticado, nunca do
corpo da requisição.

**RBAC**: papéis `ADMIN`, `GESTOR`, `VENDEDOR`, `FINANCEIRO`, `ATENDIMENTO`, `ANALISTA`.
Guard global (`RolesGuard`) + decorator `@Roles(...)` restringem endpoints
administrativos (gestão de usuários, políticas de crédito).

### Módulos (`src/modules/*`)

| Módulo | Responsabilidade |
|---|---|
| `auth` | Login, registro de organização, refresh, logout, `/me` |
| `organizations`, `users` | CRUD de organização e usuários |
| `audit` | `AuditService` — grava e lista `AuditLog` (ação, entidade, finalidade, ator) |
| `crm` | Pipelines/estágios, leads, negociações (deals), atividades, dashboard de equipe. `DealsService.markWon` cria `Customer` + `Contract` automaticamente ao ganhar uma negociação |
| `financial` | Categorias, transações, dashboard de fluxo de caixa |
| `post-sale` | Clientes, contratos, histórico de interação, sinais de churn (`ChurnService.recalculateRisk` recalcula score/nível a cada sinal), importação em massa por planilha (upsert por documento), e `customer-fields` — campos personalizados por organização (texto/sim-não/lista) que viram coluna+filtro na Carteira de Clientes automaticamente (valores guardados em `Customer.customFields`, JSON) |
| `data-intelligence` | Orquestra os **conectores** de dado (ver abaixo), grava `DataQuery` + `AuditLog` a cada consulta |
| `crivo` | `PoliciesService` (CRUD de `CreditPolicy`) + `CrivoService.evaluate` (motor de decisão) |
| `reports` | Cruzamento de dados internos + conectores em um `Report`, exportável em CSV |
| `integrations/liro-crm` | Cliente da API externa do Liro CRM (`LiroCrmConnector`), credenciais cifradas por organização, sincronização de contatos→leads e espelhamento de decisões do Crivo como tags — ver [`docs/INTEGRACAO-LIRO-CRM.md`](./INTEGRACAO-LIRO-CRM.md) |
| `integrations/personal-data-provider` | Config, por organização, do bureau real de CPF/telefone/score/parentes (Serasa, Boa Vista, Big Data Corp, Assertiva, Quod ou API própria) — credenciais cifradas, caminho de cada tipo de consulta configurável, conector genérico que chama a API real quando configurada — ver [`docs/LGPD-E-FONTES-DE-DADOS.md`](./LGPD-E-FONTES-DE-DADOS.md#41-self-service-por-organização-sem-tocar-em-código) |

### Conectores de dados (`src/modules/data-intelligence/connectors`)

Todo conector implementa a interface:

```ts
interface DataProvider<TInput, TOutput> {
  query(input: TInput): Promise<DataProviderResult<TOutput>>;
}
// DataProviderResult = { provider: string; isDemoData: boolean; data: TOutput }
```

- `cnpj.connector.ts` — chama a BrasilAPI (dado público oficial da Receita Federal).
- `cpf.connector.ts`, `phone.connector.ts`, `credit-score.connector.ts`,
  `relatives.connector.ts` — implementações **mock**, deterministas (mesmo documento →
  mesmo resultado), claramente marcadas `isDemoData: true`. É o fallback quando a
  organização não configurou um provedor real para aquele tipo de consulta.

Antes de cair no mock, `DataIntelligenceService` consulta
`PersonalDataProviderService.resolveQuery(...)` — se a organização tiver configurado um
provedor real (Configurações → Integrações) para aquele tipo específico, a consulta vai
para a API real e nunca cai silenciosamente no mock em caso de erro (ver
`integrations/personal-data-provider`). Trocar um mock por um provedor real também pode
ser feito criando uma nova classe que implementa a mesma interface e trocando o binding
no `data-intelligence.service.ts` — nenhum controller, DTO ou tela muda. Detalhes em
[`LGPD-E-FONTES-DE-DADOS.md`](./LGPD-E-FONTES-DE-DADOS.md).

### Modelo de dados

Schema completo em [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
Blocos principais: núcleo (`Organization`, `User`, `AuditLog`), CRM (`Pipeline`,
`PipelineStage`, `Lead`, `Deal`, `Activity`), financeiro (`Category`, `Transaction`),
pós-venda (`Customer`, `Contract`, `InteractionHistory`, `ChurnSignal`), inteligência de
dados (`DataQuery`, `Report`) e crivo (`CreditPolicy`, `CrivoDecision`).

## Frontend (`/frontend`)

**Stack**: React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, React Router,
Recharts, React Hook Form.

- `src/lib/api.ts` — cliente Axios com refresh automático de access token em 401.
- `src/lib/auth-context.tsx` — sessão do usuário (`useAuth`).
- `src/components/ui/*` — kit de componentes próprio (Button, Card, Table, Dialog,
  Tabs, Toast) construído em Tailwind puro — sem dependência de biblioteca de UI externa.
- `src/hooks/*` — um arquivo de hooks React Query por domínio (`useCrm`, `useFinancial`,
  `usePostSale`, `useDataIntelligence`, `useCrivo`, `useReports`, `useUsers`).
- `src/pages/*` — uma pasta por módulo, espelhando as rotas do `App.tsx`.

## Decisões notáveis

- **Cruzamento CRM → Pós-venda automático**: fechar uma negociação como "Ganho"
  (`DealsService.markWon`) cria o `Customer` e o `Contract` automaticamente,
  evitando recadastro manual.
- **Cache de consulta de CNPJ**: resultados de CNPJ são reaproveitados por 24h
  (`DataIntelligenceService.queryCnpj`) para não sobrecarregar a API pública — cada
  reuso ainda gera uma nova entrada de auditoria.
- **Score de churn**: soma ponderada dos `ChurnSignal` dos últimos 90 dias, mapeada
  para BAIXO/MÉDIO/ALTO — simples e explicável, fácil de ajustar depois.
- **Crivo**: motor de regras (não modelo estatístico) por decisão de produto —
  transparente e auditável: cada critério avaliado (situação cadastral, score,
  pendências, risco de churn) fica registrado com o resultado individual (`OK` /
  `ALERTA` / `BLOQUEIO`) que levou à decisão final.
- **Funil de Vendas em tempo real (SSE)**: `RealtimeService`
  (`backend/src/modules/realtime`) é um barramento de eventos em memória
  (RxJS `Subject`, sem Redis) — `DealsService` e `LiroCrmService` publicam
  `deal-changed` sempre que um negócio muda (drag no próprio Aster,
  webhook do Liro CRM movendo o card, exclusão), e `GET /api/realtime/deals`
  (`@Sse`) transmite isso pra quem está com o Funil aberto. O front
  (`useRealtimeDeals`) usa `fetch` + `ReadableStream` em vez de
  `EventSource` nativo — `EventSource` não manda header customizado, e o
  login usa Bearer token, não cookie. Mantém um poll de segurança bem
  espaçado (60s) só pra cobrir a conexão SSE caindo sem conseguir
  reconectar; era um poll de 5s antes disso existir. Limite conhecido: só
  alcança quem está conectado à MESMA instância do processo (rodando mais
  de uma réplica, um evento publicado numa não chega em quem está
  conectado a outra) — aceitável pro volume atual, Redis pub/sub seria o
  próximo passo se isso virar problema de verdade.
- **Code-splitting por rota**: `App.tsx` carrega cada página com
  `React.lazy()` (chunk próprio por rota, baixado só quando a rota é
  visitada) em vez de tudo num bundle só — o bundle inicial caiu de
  ~376KB gzip pra ~105KB gzip. `xlsx` (import de planilha de clientes) e
  `recharts` (gráficos do dashboard) são as duas libs mais pesadas e
  agora só entram em uso pra quem realmente visita essas telas.
- **Rate limit no login**: `POST /api/auth/login` tem um `@Throttle`
  próprio (10 tentativas/15min por IP) além do throttle global
  (200/60s) — sem isso, o global sozinho permitia ~3 tentativas de senha
  por segundo, força-bruta-ável.
- **Dedupe de webhook do Liro**: o Liro reenvia a mesma entrega (corpo
  byte-a-byte idêntico) até 3 vezes se não receber `2xx` a tempo —
  `handleInboundWebhook` ignora reentregas repetidas dentro de 10min
  (hash do token + corpo bruto, em memória), pra não reprocessar o mesmo
  evento à toa.
- **Health check**: `GET /api/health` (`HealthModule`, público) confere
  se o Postgres responde — pra monitoramento externo (UptimeRobot etc)
  saber que a API está de pé de verdade, não só que o processo Node
  está rodando.
- **Retenção de auditoria**: `AuditRetentionScheduler` roda todo dia às
  3h e apaga `AuditLog` mais antigo que `AUDIT_LOG_RETENTION_DAYS`
  (padrão 2 anos — deliberadamente conservador, é a base de conformidade
  LGPD da plataforma; ajustar esse período é decisão de negócio/jurídica,
  não só técnica).
- **2FA (TOTP)**: paridade com o Liro CRM, só pra `ADMIN`/`GESTOR`
  (Configurações → Segurança). TOTP padrão (RFC 6238, 6 dígitos, 30s,
  `src/common/utils/totp.util.ts`, HOTP validado contra o vetor de teste
  oficial do RFC), segredo cifrado com o `SecretCipher` já usado nas
  credenciais do Liro CRM. Com 2FA ligado, `POST /auth/login` devolve
  `{ twoFactorRequired: true, pendingToken }` em vez do token de acesso;
  `POST /auth/login/2fa` troca isso + o código pelo token de verdade. O
  `pendingToken` (5min, mesmo `JWT_ACCESS_SECRET`) nunca dá acesso a rota
  nenhuma da API sozinho — `JwtStrategy.validate` rejeita explicitamente
  qualquer payload com `pending2FA`.
