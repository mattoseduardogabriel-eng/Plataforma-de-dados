import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getAccessToken } from '@/lib/api';

// Reconecta com espera crescente (2s, 5s, 10s, aí trava em 15s) — evita
// martelar o backend se a conexão cair e ficar caindo (rede instável,
// deploy em andamento), sem desistir de vez (perderia o tempo real até
// alguém recarregar a página).
const RECONEXAO_MS = [2000, 5000, 10000, 15000];

/**
 * Assina o Funil de Vendas em tempo real (SSE) — sem isso, uma mudança de
 * etapa vinda de fora (webhook do Liro CRM movendo o card, outra
 * aba/pessoa mexendo no funil) só aparecia na tela quando o polling
 * batesse de novo. `EventSource` nativo não dá pra usar aqui porque não
 * manda header customizado (Authorization) — usa `fetch` +
 * `ReadableStream` e faz o parse do formato SSE (`event:`/`data:`) na mão.
 *
 * Só invalida a query de deals quando um evento de verdade chega — quem
 * decide o que fazer com isso é o próprio useDeals (React Query já só
 * refaz a busca se a query estiver sendo observada por algum componente
 * montado).
 */
export function useRealtimeDeals() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const controller = new AbortController();
    let tentativas = 0;
    let parado = false;
    let timerReconexao: ReturnType<typeof setTimeout> | undefined;

    async function conectar() {
      const token = getAccessToken();
      if (!token) return; // sem login ainda — nada a assinar

      try {
        const baseUrl = (api.defaults.baseURL ?? '').replace(/\/+$/, '');
        const res = await fetch(`${baseUrl}/realtime/deals`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`Stream indisponível (HTTP ${res.status})`);

        tentativas = 0; // conectou — reseta o backoff pra próxima queda
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!parado) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Frames SSE são separados por linha em branco dupla.
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const tipo = frame.match(/^event: ?(.*)$/m)?.[1]?.trim();
            if (tipo === 'deal-changed') {
              queryClient.invalidateQueries({ queryKey: ['crm', 'deals'] });
            }
            // "heartbeat" só mantém a conexão viva através de proxy — nada a fazer com ele.
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return; // desmontou o componente — não é erro de verdade
      }

      if (parado || controller.signal.aborted) return;
      const espera = RECONEXAO_MS[Math.min(tentativas, RECONEXAO_MS.length - 1)];
      tentativas += 1;
      timerReconexao = setTimeout(conectar, espera);
    }

    conectar();

    return () => {
      parado = true;
      controller.abort();
      clearTimeout(timerReconexao);
    };
  }, [queryClient]);
}
