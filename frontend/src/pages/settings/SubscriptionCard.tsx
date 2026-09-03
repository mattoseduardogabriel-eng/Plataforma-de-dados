import { useState } from 'react';
import { CreditCard, ShieldCheck, Clock } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui/primitives';
import { useOrganization, useConfirmSubscription } from '@/hooks/useUsers';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';
import type { SubscriptionStatus } from '@/types';

const STATUS_LABEL: Record<SubscriptionStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  TRIAL: { label: 'Período de teste', tone: 'info' },
  ACTIVE: { label: 'Ativa (em dia)', tone: 'success' },
  PAST_DUE: { label: 'Pagamento pendente', tone: 'warning' },
  CANCELED: { label: 'Cancelada', tone: 'danger' },
};

export function SubscriptionCard({ isAdmin }: { isAdmin: boolean }) {
  const { data: org, isLoading } = useOrganization();
  const confirm = useConfirmSubscription();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !org) return null;

  const status = org.subscriptionStatus as SubscriptionStatus | undefined;
  const statusInfo = status ? STATUS_LABEL[status] : null;
  const needsConfirmation = isAdmin && org.subscriptionPlan && !org.subscriptionConfirmedAt;

  const onConfirm = async () => {
    setError(null);
    try {
      await confirm.mutateAsync();
      toast({ tone: 'success', title: 'Assinatura confirmada' });
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível confirmar a assinatura.'));
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Assinatura</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex items-center gap-2">
          {statusInfo && <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>}
          {org.subscriptionConfirmedAt && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <ShieldCheck className="h-3.5 w-3.5" /> Confirmada em {formatDate(org.subscriptionConfirmedAt)}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Plano</dt>
            <dd className="font-medium text-slate-800">{org.subscriptionPlan ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Valor mensal</dt>
            <dd className="font-medium text-slate-800">
              {org.subscriptionPriceCents != null ? `R$ ${(org.subscriptionPriceCents / 100).toFixed(2)}` : '—'}
            </dd>
          </div>
          {status === 'TRIAL' && org.trialEndsAt && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Teste até</dt>
              <dd className="inline-flex items-center gap-1 font-medium text-slate-800"><Clock className="h-3.5 w-3.5" /> {formatDate(org.trialEndsAt)}</dd>
            </div>
          )}
          {org.nextBillingAt && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Próxima cobrança</dt>
              <dd className="font-medium text-slate-800">{formatDate(org.nextBillingAt)}</dd>
            </div>
          )}
        </dl>

        {!org.subscriptionPlan && (
          <p className="text-sm text-slate-500">
            O dono da plataforma ainda não definiu um plano pra sua empresa. Fale com o suporte.
          </p>
        )}

        {needsConfirmation && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-400/10">
            <p className="mb-3 text-sm text-amber-800 dark:text-amber-300">
              Confirme que revisou o plano e os valores acima pra formalizar a assinatura da sua empresa na
              plataforma.
            </p>
            <Button onClick={onConfirm} loading={confirm.isPending}>Confirmar assinatura</Button>
          </div>
        )}

        {!isAdmin && (
          <p className="text-xs text-slate-400">Só o ADMIN da empresa pode confirmar a assinatura.</p>
        )}
      </CardContent>
    </Card>
  );
}
