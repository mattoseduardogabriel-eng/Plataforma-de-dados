import { NotFoundException } from '@nestjs/common';
import { ActivitiesService } from './activities.service';

// Cobre só a parte nova: cada operação em Activity dispara (fire-and-
// forget, melhor esforço) o push correspondente pro Liro CRM. O conteúdo
// de cada push já é testado em LiroCrmService.spec.ts — aqui só garante
// que ActivitiesService CHAMA o método certo, com os dados certos.
describe('ActivitiesService — sincronização de tarefas com o Liro CRM', () => {
  let service: ActivitiesService;
  let prisma: any;
  let liroCrmService: any;

  beforeEach(() => {
    prisma = {
      activity: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    liroCrmService = {
      pushTaskCreate: jest.fn().mockResolvedValue(undefined),
      pushTaskUpdate: jest.fn().mockResolvedValue(undefined),
      pushTaskDelete: jest.fn().mockResolvedValue(undefined),
    };
    service = new ActivitiesService(prisma, liroCrmService);
  });

  it('create: dispara pushTaskCreate com o id da atividade recém-criada', async () => {
    prisma.activity.create.mockResolvedValue({ id: 'activity-1' });

    await service.create('org-1', 'user-1', { type: 'TAREFA', title: 'Ligar' } as any);

    expect(liroCrmService.pushTaskCreate).toHaveBeenCalledWith('org-1', 'activity-1');
  });

  it('markDone: dispara pushTaskUpdate mesmo pra uma tarefa que nasceu no Liro (espelha as duas direções)', async () => {
    prisma.activity.findFirst.mockResolvedValue({ id: 'activity-2', origin: 'liro' });
    prisma.activity.update.mockResolvedValue({ id: 'activity-2', doneAt: new Date() });

    await service.markDone('org-1', 'activity-2');

    expect(liroCrmService.pushTaskUpdate).toHaveBeenCalledWith('org-1', 'activity-2');
  });

  it('markDone: atividade inexistente — lança 404 e não chama o Liro', async () => {
    prisma.activity.findFirst.mockResolvedValue(null);

    await expect(service.markDone('org-1', 'nao-existe')).rejects.toThrow(NotFoundException);
    expect(liroCrmService.pushTaskUpdate).not.toHaveBeenCalled();
  });

  it('remove: dispara pushTaskDelete com o externalId da atividade excluída', async () => {
    prisma.activity.findFirst.mockResolvedValue({ id: 'activity-3', externalId: 'liro-task-3' });

    await service.remove('org-1', 'activity-3');

    expect(prisma.activity.delete).toHaveBeenCalledWith({ where: { id: 'activity-3' } });
    expect(liroCrmService.pushTaskDelete).toHaveBeenCalledWith('org-1', 'liro-task-3');
  });

  it('removeCompleted: dispara pushTaskDelete uma vez por atividade afetada, sem travar a resposta', async () => {
    prisma.activity.findMany.mockResolvedValue([
      { id: 'activity-4', externalId: 'liro-task-4' },
      { id: 'activity-5', externalId: null }, // nunca sincronizou — pushTaskDelete lida com isso sozinho
    ]);
    prisma.activity.deleteMany.mockResolvedValue({ count: 2 });

    const resultado = await service.removeCompleted('org-1', {});

    expect(resultado).toEqual({ removed: 2 });
    expect(liroCrmService.pushTaskDelete).toHaveBeenCalledTimes(2);
    expect(liroCrmService.pushTaskDelete).toHaveBeenCalledWith('org-1', 'liro-task-4');
    expect(liroCrmService.pushTaskDelete).toHaveBeenCalledWith('org-1', null);
  });
});
