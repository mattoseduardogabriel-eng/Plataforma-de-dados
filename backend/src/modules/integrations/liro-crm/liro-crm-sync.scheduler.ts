import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LiroCrmService } from './liro-crm.service';
import { AuditService } from '../../audit/audit.service';

// Quantas RODADAS seguidas do cron (a cada 5min) precisam falhar pra essa
// organização antes de soar alerta — 5 rodadas ~25min de falha contínua,
// o suficiente pra descartar uma instabilidade passageira isolada (deploy
// em andamento, soluço de rede) sem demorar horas pra avisar de um
// problema persistente (chave revogada, Liro fora do ar de vez).
const ALERTA_RODADAS_SEGUIDAS = 5;

/**
 * Sincronização automática com o Liro CRM — sem isso, contatos novos só
 * chegavam quando alguém clicava em "Sincronizar contatos agora" na tela
 * de Integrações. Roda a cada poucos minutos pra toda organização que já
 * tem a integração conectada, sem precisar de ninguém logado olhando a
 * tela. Uma organização falhando (chave revogada, Liro fora do ar) nunca
 * derruba as outras — cada uma roda isolada, com o próprio try/catch.
 */
@Injectable()
export class LiroCrmSyncScheduler {
  private readonly logger = new Logger(LiroCrmSyncScheduler.name);
  // Evita rodar duas varreduras ao mesmo tempo se uma sincronização atrasar
  // (empresa com muitos contatos) e o próximo disparo do cron já chegar.
  private rodando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly liroCrmService: LiroCrmService,
    private readonly auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sincronizarTodasAsOrganizacoes(): Promise<void> {
    if (this.rodando) {
      this.logger.warn('Sincronização automática anterior ainda em andamento — pulando esta rodada.');
      return;
    }
    this.rodando = true;

    try {
      const organizacoes = await this.prisma.organization.findMany({
        where: { liroCrmApiKeyEncrypted: { not: null }, liroCrmBaseUrl: { not: null } },
        select: { id: true, name: true },
      });

      for (const org of organizacoes) {
        try {
          // Nenhuma pessoa logada disparou isso — atribui a um usuário
          // real da organização (o mais antigo) só porque Lead/Deal
          // exigem createdById/ownerId; puramente contábil, não afeta
          // permissão nem visibilidade de nada.
          const usuario = await this.prisma.user.findFirst({
            where: { organizationId: org.id },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          });
          if (!usuario) continue;

          const resultado = await this.liroCrmService.syncContacts(org.id, usuario.id);
          if (resultado.created > 0 || resultado.updated > 0) {
            this.logger.log(
              `Sync automático (org ${org.name}): ${resultado.created} novo(s), ${resultado.updated} atualizado(s).`,
            );
          }
          // Zera o contador só se ele não já estava zerado — evita um
          // UPDATE por organização a cada 5min pra sempre (a maioria das
          // rodadas é sucesso).
          await this.prisma.organization.updateMany({
            where: { id: org.id, liroCrmSyncFailureCount: { not: 0 } },
            data: { liroCrmSyncFailureCount: 0, liroCrmLastSyncError: null },
          });
        } catch (error) {
          const mensagem = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Sync automático falhou pra organização ${org.name} (${org.id}): ${mensagem}`);

          const atualizada = await this.prisma.organization.update({
            where: { id: org.id },
            data: { liroCrmSyncFailureCount: { increment: 1 }, liroCrmLastSyncError: mensagem.slice(0, 500) },
          });

          // Alerta só na hora exata em que cruza o limite — não em toda
          // rodada depois disso, senão vira spam de auditoria pra uma
          // integração quebrada há dias. Volta a poder alertar depois do
          // próximo sucesso, que zera o contador acima.
          if (atualizada.liroCrmSyncFailureCount === ALERTA_RODADAS_SEGUIDAS) {
            await this.auditService.log({
              organizationId: org.id,
              action: 'LIRO_CRM_SYNC_REPEATED_FAILURE',
              entityType: 'Organization',
              entityId: org.id,
              metadata: { consecutiveFailures: atualizada.liroCrmSyncFailureCount, lastError: mensagem.slice(0, 500) },
            });
          }
        }
      }
    } finally {
      this.rodando = false;
    }
  }
}
