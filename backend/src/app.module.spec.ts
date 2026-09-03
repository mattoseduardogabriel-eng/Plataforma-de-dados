// Só pra deixar o grafo de DI compilável de forma isolada — alguns
// provedores (ex: SecretCipher) exigem essas variáveis já no construtor,
// antes de qualquer rota rodar. Valores fake, nunca usados de verdade
// (o teste só monta o módulo e fecha, não abre servidor nem conecta em
// nada). Precisa vir ANTES do import de AppModule, que carrega o
// ConfigModule que lê essas variáveis na hora em que os providers são
// instanciados.
process.env.JWT_ACCESS_SECRET ??= 'teste-di-graph';
process.env.JWT_REFRESH_SECRET ??= 'teste-di-graph';
process.env.SECRET_ENCRYPTION_KEY ??= 'teste-di-graph-teste-di-graph-32';

import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

/**
 * Compila o grafo de injeção de dependência do app inteiro — sem subir
 * servidor, sem conectar no banco (PrismaService só conecta em
 * onModuleInit, que `.compile()` não dispara). Pega exatamente a classe de
 * erro "Nest can't resolve dependencies of X, argument Y está faltando no
 * módulo" — um serviço novo ganhar uma dependência nova (ex: AuditService)
 * sem o módulo correspondente (AuditModule) importado no módulo de origem.
 * `tsc` e os testes unitários normais não pegam isso: só aparece quando o
 * Nest tenta montar a aplicação de verdade, e foi exatamente o que
 * derrubou o deploy de produção uma vez (DealsService -> AuditService
 * sem AuditModule em CrmModule).
 */
describe('AppModule (grafo de DI)', () => {
  it('compila sem erro de dependência faltando', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.close();
  });
});
