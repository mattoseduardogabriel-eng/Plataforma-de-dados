import { useState } from 'react';
import { RefreshCw, Unlink } from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Spinner } from '@/components/ui/primitives';
import {
  useLiroCrmStatus,
  useSaveLiroCrmCredentials,
  useRemoveLiroCrmCredentials,
  useTestLiroCrmConnection,
  useSyncLiroCrmContacts,
  useLiroCrmKanbanStages,
  useSetLiroCrmStageMapping,
} from '@/hooks/useIntegrations';
import { usePipelines } from '@/hooks/useCrm';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/utils';

export function LiroCrmIntegrationCard({ isAdmin }: { isAdmin: boolean }) {
  const { data: status, isLoading } = useLiroCrmStatus();
  const save = useSaveLiroCrmCredentials();
  const remove = useRemoveLiroCrmCredentials();
  const test = useTestLiroCrmConnection();
  const sync = useSyncLiroCrmContacts();
  const { data: pipelines } = usePipelines();
  const { data: liroStages } = useLiroCrmKanbanStages(!!status?.configured);
  const setMapping = useSetLiroCrmStageMapping();
  const { toast } = useToast();

  const [form, setForm] = useState({ apiKey: '', baseUrl: '' });

  const onChangeMapping = async (pipelineStageId: string, liroKanbanStageId: string) => {
    const liroStage = liroStages?.find((s) => s.id === liroKanbanStageId);
    try {
      await setMapping.mutateAsync({
        pipelineStageId,
        liroKanbanStageId: liroKanbanStageId || null,
        liroKanbanStageName: liroStage?.name ?? null,
      });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao salvar mapeamento', description: extractErrorMessage(err) });
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync(form);
      toast({ tone: 'success', title: 'Integração com o Liro CRM conectada' });
      setForm({ apiKey: '', baseUrl: '' });
    } catch (err) {
      toast({ tone: 'error', title: 'Não foi possível conectar', description: extractErrorMessage(err) });
    }
  };

  const onTest = async () => {
    try {
      await test.mutateAsync();
      toast({ tone: 'success', title: 'Conexão com o Liro CRM funcionando' });
    } catch (err) {
      toast({ tone: 'error', title: 'Falha na conexão', description: extractErrorMessage(err) });
    }
  };

  const onSync = async () => {
    try {
      const result = await sync.mutateAsync();
      toast({
        tone: 'success',
        title: 'Sincronização concluída',
        description: `${result.created} novo(s) lead(s), ${result.updated} atualizado(s) de ${result.total} contato(s).`,
      });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao sincronizar', description: extractErrorMessage(err) });
    }
  };

  const onRemove = async () => {
    try {
      await remove.mutateAsync();
      toast({ tone: 'success', title: 'Integração removida' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao remover', description: extractErrorMessage(err) });
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Liro CRM</CardTitle>
        {status?.configured && <Badge tone="success">Conectado</Badge>}
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-slate-500">
          Sincroniza contatos do Liro CRM como leads aqui e devolve os resultados do Crivo e das consultas de
          inteligência de dados como tags no contato — o atendente vê o resultado direto no Liro, sem precisar sair
          de lá.
        </p>

        {isLoading ? (
          <Spinner />
        ) : status?.configured ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Base URL</p>
                <p className="font-medium text-slate-800">{status.baseUrl}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Chave</p>
                <p className="font-medium text-slate-800">••••{status.apiKeySuffix}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Última sincronização</p>
                <p className="font-medium text-slate-800">
                  {status.lastSyncedAt ? formatDateTime(status.lastSyncedAt) : 'Nunca sincronizado'}
                </p>
              </div>
            </div>
            {status.syncFailing && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                ⚠ A sincronização automática está falhando há {status.syncFailureCount} rodada(s) seguida(s)
                {status.lastSyncError ? ` — ${status.lastSyncError}` : ''}. Confira a chave de API e a Base URL.
              </p>
            )}
            {status.taskSyncFailing && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                ⚠ A sincronização de tarefas está falhando há {status.taskSyncFailureCount} tentativa(s) seguida(s)
                {status.lastTaskSyncError ? ` — ${status.lastTaskSyncError}` : ''}. Confira a chave de API e a Base URL.
              </p>
            )}
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onTest} loading={test.isPending}>
                  Testar conexão
                </Button>
                <Button size="sm" onClick={onSync} loading={sync.isPending}>
                  <RefreshCw className="h-4 w-4" /> Sincronizar contatos agora
                </Button>
                <Button size="sm" variant="destructive" onClick={onRemove} loading={remove.isPending}>
                  <Unlink className="h-4 w-4" /> Desconectar
                </Button>
              </div>
            )}

            {isAdmin && (
              <div className="border-t border-slate-300/60 pt-4">
                <p className="mb-1 text-sm font-medium text-slate-800">Sincronização de funil</p>
                <p className="mb-3 text-xs text-slate-500">
                  Mover um negócio pra uma etapa mapeada reflete no Liro CRM (só se o lead já tiver conversa aberta
                  por lá) e vice-versa, em tempo real. Etapa sem mapeamento nunca reflete em nenhuma direção.
                </p>
                {!liroStages ? (
                  <Spinner className="h-5 w-5" />
                ) : (
                  <div className="space-y-3">
                    {pipelines?.map((pipeline) => (
                      <div key={pipeline.id}>
                        {pipelines.length > 1 && <p className="mb-1 text-xs font-medium text-slate-500">{pipeline.name}</p>}
                        <div className="space-y-1">
                          {pipeline.stages.map((stage) => (
                            <div key={stage.id} className="flex items-center gap-2 text-sm">
                              <span className="w-40 shrink-0 truncate text-slate-700">{stage.name}</span>
                              <span className="text-slate-400">↔</span>
                              <Select
                                className="flex-1"
                                value={stage.liroKanbanStageId ?? ''}
                                onChange={(e) => onChangeMapping(stage.id, e.target.value)}
                                disabled={setMapping.isPending}
                              >
                                <option value="">Sem correspondência no Liro</option>
                                {liroStages.map((liroStage) => (
                                  <option key={liroStage.id} value={liroStage.id}>
                                    {liroStage.name}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isAdmin ? (
          <form onSubmit={onSave} className="space-y-4">
            <div>
              <Label>Base URL da API do Liro CRM</Label>
              <Input
                required
                placeholder="https://app.lirocrm.com.br/api/external/v1"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              />
            </div>
            <div>
              <Label>Chave de API (Configurações → API pra integração externa, no Liro)</Label>
              <Input
                required
                type="password"
                placeholder="liro_..."
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              />
            </div>
            <Button type="submit" loading={save.isPending}>
              Conectar
            </Button>
          </form>
        ) : (
          <Alert tone="info">Peça a um administrador da organização para conectar o Liro CRM.</Alert>
        )}
      </CardContent>
    </Card>
  );
}
