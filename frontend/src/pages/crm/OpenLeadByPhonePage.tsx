import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spinner, Button, EmptyState } from '@/components/ui/primitives';
import { api, extractErrorMessage } from '@/lib/api';

/**
 * Alvo do deep-link "Abrir no Aster", clicado de dentro de uma conversa do
 * Liro CRM (?phone=...). Só resolve o telefone pra um lead e navega — não
 * é uma tela pra ficar, é uma ponte. Espelha, na direção contrária, o que
 * `openLiroCrmConversation` (lib/liro-crm.ts) faz pro sentido Aster → Liro.
 */
export function OpenLeadByPhonePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const phone = params.get('phone') ?? '';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) {
      setError('Nenhum telefone informado no link.');
      return;
    }
    let cancelado = false;
    api
      .get<{ id: string }>('/crm/leads/by-phone', { params: { phone } })
      .then(({ data }) => {
        if (!cancelado) navigate(`/crm/leads/${data.id}`, { replace: true });
      })
      .catch((err) => {
        if (!cancelado) setError(extractErrorMessage(err));
      });
    return () => {
      cancelado = true;
    };
  }, [phone, navigate]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          title="Lead não encontrado"
          description={error}
          action={<Button onClick={() => navigate('/crm/leads')}>Ver todos os leads</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-slate-500">
      <Spinner />
      Procurando o lead desse telefone...
    </div>
  );
}
