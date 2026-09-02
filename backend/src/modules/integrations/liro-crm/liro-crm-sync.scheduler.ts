import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LiroCrmService } from './liro-crm.service';

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
        } catch (error) {
          this.logger.warn(
            `Sync automático falhou pra organização ${org.name} (${org.id}): ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }
    } finally {
      this.rodando = false;
    }
  }
}
