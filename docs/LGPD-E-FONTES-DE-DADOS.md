# LGPD e Fontes de Dados

Este documento explica **o que é dado real e o que é simulado** nesta plataforma, por
que essa distinção existe, e o que fazer para operar com dados pessoais reais em
produção, dentro da lei.

## 1. Por que a plataforma não faz scraping ou usa bases "vazadas"

Serviços de "consulta de CPF/telefone/parentes" baratos ou gratuitos, no Brasil, quase
sempre são alimentados por bases de dados obtidas ilegalmente (vazamentos, raspagem sem
consentimento) ou por revenda não autorizada de dados de bureaus. Isso:

- viola a **Lei Geral de Proteção de Dados (Lei 13.709/2018)**, sujeitando a empresa a
  multas de até 2% do faturamento (limitadas a R$ 50 milhões por infração) e a
  responsabilização civil/criminal dos envolvidos;
- expõe o titular dos dados a risco real de fraude, stalking e discriminação;
- é o tipo de operação que a ANPD (Autoridade Nacional de Proteção de Dados) já
  autuou publicamente diversas vezes.

Por isso, esta plataforma **não inclui, não incentiva e não facilita** o uso de bases
não licenciadas. O caminho correto — e o único sustentável para uma empresa séria — é
contratar um provedor licenciado e operar com finalidade e base legal declaradas.

## 2. O que é real hoje

| Dado | Fonte | Status |
|---|---|---|
| CNPJ (situação cadastral, sócios, CNAE, endereço) | [BrasilAPI](https://brasilapi.com.br), que agrega dados públicos da Receita Federal | **Real**, funciona hoje, sem custo, sem contrato — porque é dado **público** por definição legal (art. 37 da Constituição, princípio da publicidade dos atos da administração; a própria Receita Federal disponibiliza o Cadastro Nacional da Pessoa Jurídica). |
| DDD → UF do telefone | Plano de numeração público da Anatel | **Real** — dado público de infraestrutura de telecom, não é dado pessoal. |
| Validação de dígito verificador de CPF | Algoritmo público do Módulo 11 | **Real** — é matemática, não uma consulta a base nenhuma; confirma apenas que o número é *estruturalmente* válido, não que existe ou pertence a alguém. |

## 3. O que é demonstração (mock) hoje — e por quê

| Dado | Conector | Por que é mock |
|---|---|---|
| Dossiê de CPF (nome, situação, faixa etária, região) | `cpf.connector.ts` | Dado pessoal de terceiro. Consultar de verdade exige contrato com bureau e base legal (LGPD art. 7º). |
| Score de crédito | `credit-score.connector.ts` | Só existe de verdade através de um bureau de crédito (Serasa, Boa Vista, Quod, Big Data Corp), que calcula o score a partir de dados que a plataforma não tem acesso. |
| Telefone: operadora e tipo de linha | `phone.connector.ts` | Titularidade/portabilidade real exige consulta a bureau ou operadora. |
| Vínculos familiares/parentesco | `relatives.connector.ts` | **O mais sensível dos cinco.** Um "grafo de relacionamentos" real cruza múltiplas bases de terceiros — é a funcionalidade mais associada a abuso (stalking, doxxing) quando feita sem licença. Só deve existir em produção com provedor licenciado e avaliação jurídica prévia específica para esse caso de uso. |

Cada conector mock:

1. É **determinístico** — o mesmo documento sempre gera o mesmo resultado sintético
   (útil para demonstração e testes), mas o resultado **não corresponde a nenhuma
   pessoa real**.
2. Devolve `isDemoData: true`, que a interface usa para mostrar um aviso amarelo
   explícito em toda tela de consulta.
3. Implementa a mesma interface `DataProvider` que um conector real usaria — trocar um
   mock por produção é uma questão de escrever uma classe nova, não de redesenhar o
   sistema.

## 4. Como plugar um provedor real

1. Contrate um provedor licenciado adequado ao seu caso de uso — por exemplo:
   - **Serasa Experian** ou **Boa Vista SCPC** — score de crédito, CPF/CNPJ.
   - **Big Data Corp** ou **Assertiva** — CPF, telefone, vínculos, KYC.
   - **Quod** — score de crédito (bureau positivo).
2. Implemente a interface em um novo arquivo, por exemplo
   `src/modules/data-intelligence/connectors/credit-score.serasa.connector.ts`:
   ```ts
   @Injectable()
   export class SerasaCreditScoreConnector implements DataProvider<string, CreditScoreQueryResult> {
     async query(document: string) {
       // chamada HTTP autenticada à API do provedor contratado
       return { provider: 'serasa-experian', isDemoData: false, data: { /* ... */ } };
     }
   }
   ```
3. Troque o binding em `data-intelligence.module.ts` (`CreditScoreConnector` →
   `SerasaCreditScoreConnector`).
4. Preencha as credenciais no `.env` (`CREDIT_BUREAU_API_KEY`,
   `CREDIT_BUREAU_BASE_URL` — placeholders já previstos em `.env.example`).
5. **Antes de ir ao ar**: revise a finalidade e a base legal de cada tipo de consulta
   com seu jurídico/DPO, atualize a política de privacidade da empresa e garanta que o
   contrato com o provedor cobre o uso pretendido (crédito, prevenção a fraude, etc.).

## 5. O que já está embutido para conformidade

- **Finalidade obrigatória**: todo endpoint de consulta de dado pessoal
  (`/data-intelligence/*/query`, `/crivo/evaluate`, `/reports`) exige o campo `purpose`
  — a interface não deixa consultar sem preencher "para quê".
- **Auditoria completa**: cada consulta grava um `AuditLog` com quem consultou, o quê,
  quando e a finalidade declarada. Visível em `/auditoria` para qualquer usuário da
  organização — essencial para responder a uma auditoria da ANPD ou a uma solicitação
  do titular dos dados (LGPD art. 18 — direito de confirmação e acesso).
- **Multi-tenant estrito**: uma organização nunca acessa consultas ou dados de outra.
- **Rótulo de dado real vs. simulado** em toda resposta (`isDemoData`), para nunca
  confundir um dado de demonstração com um dado real ao tomar uma decisão de crédito.

## 6. Responsabilidade de quem opera a plataforma

Ativar um provedor real de dados pessoais faz da organização operadora uma
**controladora de dados** nos termos da LGPD. Isso implica, no mínimo:

- ter uma base legal válida para cada tratamento (tipicamente **legítimo interesse**
  para análise de crédito e prevenção a fraude — art. 7º, IX, exige teste de
  proporcionalidade documentado);
- manter um canal para o titular exercer seus direitos (acesso, correção, exclusão);
- designar um encarregado de dados (DPO) se aplicável ao porte da empresa;
- não usar os dados para finalidade diferente da declarada na consulta.

Nada disso é automatizável pelo código — é uma responsabilidade jurídica e
organizacional de quem opera a plataforma em produção.
