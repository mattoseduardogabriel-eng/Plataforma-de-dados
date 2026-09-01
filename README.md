# Plataforma de Dados

Plataforma completa de **CRM de vendas**, **financeiro**, **pós-venda/relacionamento** e
**inteligência de dados** (consulta de CNPJ, CPF, telefone, score de crédito, vínculos
familiares e cruzamento de dados), com um motor de decisão de crédito (**Crivo**) e
auditoria completa orientada à LGPD.

Construída para uma operação de **franquia de telecomunicações**, mas o núcleo (CRM +
financeiro + pós-venda + inteligência de dados + crivo) serve qualquer negócio B2B que
qualifica leads, vende planos/contratos recorrentes e precisa analisar crédito e dados
cadastrais antes de fechar negócio.

## Módulos

| Módulo | O que faz |
|---|---|
| **CRM de Vendas** | Funil kanban configurável, leads, negociações, atividades, ranking/desempenho da equipe comercial. Fechar uma negociação como "Ganho" cria automaticamente o cliente e o contrato no módulo de Pós-venda. |
| **Financeiro** | Lançamentos de receita/despesa, categorias, dashboard de fluxo de caixa (mensal, 6 meses), inadimplência. |
| **Pós-venda** | Carteira de clientes, contratos, histórico de atendimento, sinais e score de risco de cancelamento (churn). |
| **Inteligência de Dados** | Consulta de **CNPJ** (dado público oficial, Receita Federal via BrasilAPI), **CPF**, **telefone**, **score de crédito** e **vínculos/parentesco** (conectores plugáveis — ver [`docs/LGPD-E-FONTES-DE-DADOS.md`](docs/LGPD-E-FONTES-DE-DADOS.md)). Toda consulta de dado pessoal exige finalidade declarada e é auditada. |
| **Crivo** | Motor de decisão de crédito: combina situação cadastral, score e pendências contra políticas configuráveis para aprovar, reprovar ou enviar à análise manual, com limite de crédito sugerido. |
| **Cruzamento de Dados** | Relatórios que combinam dados internos (CRM/financeiro/pós-venda) com os conectores externos em um dossiê único, exportável em CSV. |
| **Auditoria (LGPD)** | Log de toda ação sensível — quem, o quê, quando e com qual finalidade — essencial para operar legalmente com dados pessoais. |

## Arquitetura

```
/backend     NestJS + TypeScript + Prisma + PostgreSQL — API REST (documentada em /api/docs)
/frontend    React + Vite + TypeScript + Tailwind — SPA
docker-compose.yml
docs/
  ARQUITETURA.md
  LGPD-E-FONTES-DE-DADOS.md
```

Veja o detalhamento em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Como rodar

### Opção 1 — Docker Compose (recomendado)

```bash
docker compose up --build
```

- API: http://localhost:3001/api (Swagger em `/api/docs`)
- Frontend: http://localhost:5173
- O banco é migrado e populado com dados de demonstração automaticamente no primeiro start.

### Opção 2 — Manual (desenvolvimento)

Requer Node 20+ e PostgreSQL 16+ rodando localmente.

```bash
# Backend
cd backend
cp .env.example .env        # ajuste DATABASE_URL se necessário
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev           # http://localhost:3001/api

# Frontend (em outro terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

## Login de demonstração

Após rodar o seed (`npm run prisma:seed` ou automaticamente via Docker Compose), use
qualquer um dos usuários abaixo — senha `Demo@123456` para todos:

| Papel | E-mail |
|---|---|
| Administrador | `admin@franquiademo.com.br` |
| Gestor | `gestor@franquiademo.com.br` |
| Vendedor | `carla@franquiademo.com.br` / `diego@franquiademo.com.br` |
| Financeiro | `financeiro@franquiademo.com.br` |
| Atendimento | `atendimento@franquiademo.com.br` |
| Analista | `analista@franquiademo.com.br` |

Ou crie sua própria organização em `/registrar`.

## Fontes de dados: o que é real e o que é demonstração

- **CNPJ**: dado público oficial, obtido em tempo real da Receita Federal via
  [BrasilAPI](https://brasilapi.com.br) — funciona de verdade, sem necessidade de contrato.
- **CPF, telefone, score de crédito e vínculos/parentesco**: rodam em **modo
  demonstração** — os conectores geram dados sintéticos e determinísticos, claramente
  sinalizados na interface (`isDemoData: true`), atrás da mesma interface `DataProvider`
  que um provedor licenciado usaria em produção.

Isso é proposital: consultar dados pessoais reais de terceiros (CPF, telefone,
composição familiar) exige base legal e, na prática, contrato com um bureau licenciado
(Serasa Experian, Boa Vista SCPC, Big Data Corp, Assertiva, Quod). Detalhes de como
plugar um provedor real, e as obrigações de LGPD embutidas na plataforma (finalidade
obrigatória + auditoria), estão em
[`docs/LGPD-E-FONTES-DE-DADOS.md`](docs/LGPD-E-FONTES-DE-DADOS.md).

## Testes

```bash
cd backend
npm test
```

## Documentação da API

Com o backend rodando, a documentação interativa (Swagger/OpenAPI) fica disponível em
`http://localhost:3001/api/docs`.
