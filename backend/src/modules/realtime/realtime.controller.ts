import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { RealtimeService } from './realtime.service';

// Intervalo de "estou vivo" — sem isso, um proxy/load balancer no meio do
// caminho (ex: Railway, nginx) pode fechar a conexão por ficar tempo
// demais sem tráfego nenhum, mesmo que ninguém tenha mandado erro nenhum.
const HEARTBEAT_MS = 20000;

@ApiTags('tempo real')
@RequireFeature('crm')
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  // GET /api/realtime/deals — Funil de Vendas assina esse stream em vez
  // de perguntar de tempos em tempos se algo mudou (ver useDeals no
  // front). Emite um evento "deal-changed" toda vez que um negócio da
  // organização é criado/movido/removido, de qualquer origem (drag no
  // próprio Aster, webhook do Liro CRM, outra aba/pessoa).
  @Sse('deals')
  dealsStream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    const heartbeat$ = interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'heartbeat', data: {} })));
    return merge(this.realtimeService.stream(user.organizationId), heartbeat$);
  }
}
