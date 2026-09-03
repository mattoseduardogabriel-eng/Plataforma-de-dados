import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface RealtimeMessage {
  organizationId: string;
  event: string;
  data: object;
}

/**
 * Barramento de eventos em tempo real (SSE) pra empurrar mudanças pro
 * navegador assim que acontecem, em vez do front ficar perguntando
 * "mudou alguma coisa?" de tempos em tempos (polling) — hoje usado pra
 * avisar o Funil de Vendas quando um negócio muda de etapa por fora
 * (webhook do Liro CRM movendo o card, ou outra aba/pessoa da mesma
 * organização mexendo no funil), sem esperar o próximo ciclo de
 * atualização.
 *
 * Em memória de propósito, sem Redis/pub-sub externo — como
 * ImportJob (ver customers.service.ts), resolve o problema real (UI
 * desatualizada até o próximo poll) sem pedir infra nova. Limite
 * conhecido: só alcança quem está conectado à MESMA instância do
 * processo; rodando mais de uma réplica do backend, um evento publicado
 * numa réplica não chega em quem está conectado a outra. Se isso virar
 * problema de verdade (múltiplas réplicas), o próximo passo é um
 * pub/sub via Redis por trás desse mesmo publish()/stream().
 */
@Injectable()
export class RealtimeService {
  private readonly subject = new Subject<RealtimeMessage>();

  publish(organizationId: string, event: string, data: object): void {
    this.subject.next({ organizationId, event, data });
  }

  /** Stream filtrado pra só os eventos da organização de quem está conectado — nunca vaza evento de outra empresa. */
  stream(organizationId: string): Observable<MessageEvent> {
    return this.subject.asObservable().pipe(
      filter((msg) => msg.organizationId === organizationId),
      map((msg): MessageEvent => ({ type: msg.event, data: msg.data })),
    );
  }
}
