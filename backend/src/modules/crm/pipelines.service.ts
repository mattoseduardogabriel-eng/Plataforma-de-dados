import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePipelineStageDto } from './dto/create-pipeline-stage.dto';

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organizationId: string) {
    return this.prisma.pipeline.findMany({
      where: { organizationId },
      include: { stages: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Nova etapa sempre entra no fim do funil — mesma decisão do Kanban do
  // Liro CRM: reordenar as ETAPAS em si não é algo que essa tela ofereça
  // ainda, só arrastar os CARDS entre as etapas existentes.
  async createStage(organizationId: string, pipelineId: string, dto: CreatePipelineStageDto) {
    const pipeline = await this.prisma.pipeline.findFirst({ where: { id: pipelineId, organizationId } });
    if (!pipeline) {
      throw new NotFoundException('Funil não encontrado.');
    }

    const ultima = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId },
      orderBy: { order: 'desc' },
    });

    return this.prisma.pipelineStage.create({
      data: { pipelineId, name: dto.name.trim(), order: (ultima?.order ?? 0) + 1 },
    });
  }

  async deleteStage(organizationId: string, stageId: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipeline: { organizationId } },
    });
    if (!stage) {
      throw new NotFoundException('Etapa do funil não encontrada.');
    }

    const totalEtapas = await this.prisma.pipelineStage.count({ where: { pipelineId: stage.pipelineId } });
    if (totalEtapas <= 1) {
      throw new BadRequestException('Não dá pra excluir a última etapa — o funil precisa ter pelo menos uma.');
    }

    // Deal.stageId é obrigatório (nunca null) — não dá pra excluir uma
    // etapa que ainda tem negócio nela, senão o negócio fica órfão. Quem
    // quiser excluir precisa mover os cards antes (arrastando no próprio
    // quadro).
    const emUso = await this.prisma.deal.count({ where: { stageId } });
    if (emUso > 0) {
      throw new BadRequestException(
        `Essa etapa tem ${emUso} negócio(s). Mova ${emUso === 1 ? 'ele' : 'eles'} pra outra etapa antes de excluir.`,
      );
    }

    await this.prisma.pipelineStage.delete({ where: { id: stageId } });
    return { deleted: true };
  }
}
