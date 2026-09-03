import { firstValueFrom, take, toArray } from 'rxjs';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  let service: RealtimeService;

  beforeEach(() => {
    service = new RealtimeService();
  });

  it('entrega o evento pra quem está assinando a mesma organização', async () => {
    const recebido = firstValueFrom(service.stream('org-1'));

    service.publish('org-1', 'deal-changed', { dealId: 'deal-1' });

    await expect(recebido).resolves.toEqual({ type: 'deal-changed', data: { dealId: 'deal-1' } });
  });

  it('nunca entrega evento de outra organização (isolamento entre empresas)', async () => {
    const eventosOrg2 = firstValueFrom(service.stream('org-2').pipe(take(1)));

    service.publish('org-1', 'deal-changed', { dealId: 'deal-1' });
    service.publish('org-2', 'deal-changed', { dealId: 'deal-2' });

    await expect(eventosOrg2).resolves.toEqual({ type: 'deal-changed', data: { dealId: 'deal-2' } });
  });

  it('vários assinantes da mesma organização recebem o mesmo evento', async () => {
    const assinante1 = firstValueFrom(service.stream('org-1'));
    const assinante2 = firstValueFrom(service.stream('org-1'));

    service.publish('org-1', 'deal-changed', { dealId: 'deal-1' });

    const [r1, r2] = await Promise.all([assinante1, assinante2]);
    expect(r1).toEqual(r2);
  });

  it('publica vários eventos em sequência, cada um chegando na ordem', async () => {
    const eventos = firstValueFrom(service.stream('org-1').pipe(take(2), toArray()));

    service.publish('org-1', 'deal-changed', { dealId: 'deal-1' });
    service.publish('org-1', 'deal-changed', { dealId: 'deal-2' });

    const resultado = await eventos;
    expect(resultado.map((e) => (e.data as { dealId: string }).dealId)).toEqual(['deal-1', 'deal-2']);
  });
});
