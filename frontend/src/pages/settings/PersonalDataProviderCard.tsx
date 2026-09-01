import { useState } from 'react';
import { ChevronDown, ChevronUp, Unlink } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Spinner,
} from '@/components/ui/primitives';
import {
  usePersonalDataProviderStatus,
  useSavePersonalDataProviderConfig,
  useRemovePersonalDataProviderConfig,
  useTestPersonalDataProviderConnection,
} from '@/hooks/useIntegrations';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/utils';
import { PERSONAL_DATA_PROVIDERS, type PersonalDataProviderName } from '@/types';

const PROVIDER_LABELS: Record<PersonalDataProviderName, string> = {
  SERASA: 'Serasa Experian',
  BOA_VISTA: 'Boa Vista SCPC',
  BIG_DATA_CORP: 'Big Data Corp',
  ASSERTIVA: 'Assertiva',
  QUOD: 'Quod',
  GENERICO: 'Outro / API própria',
};

const EMPTY_FORM = {
  provider: 'SERASA' as PersonalDataProviderName,
  baseUrl: '',
  apiKey: '',
  authHeaderName: 'Authorization',
  authScheme: 'Bearer',
  cpfPath: '',
  phonePath: '',
  creditScorePath: '',
  relativesPath: '',
};

export function PersonalDataProviderCard({ isAdmin }: { isAdmin: boolean }) {
  const { data: status, isLoading } = usePersonalDataProviderStatus();
  const save = useSavePersonalDataProviderConfig();
  const remove = useRemovePersonalDataProviderConfig();
  const test = useTestPersonalDataProviderConnection();
  const { toast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        provider: form.provider,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        authHeaderName: form.authHeaderName || undefined,
        authScheme: form.authScheme,
        cpfPath: form.cpfPath || undefined,
        phonePath: form.phonePath || undefined,
        creditScorePath: form.creditScorePath || undefined,
        relativesPath: form.relativesPath || undefined,
      });
      toast({ tone: 'success', title: 'Provedor de dados pessoais conectado' });
      setForm(EMPTY_FORM);
    } catch (err) {
      toast({ tone: 'error', title: 'Não foi possível salvar', description: extractErrorMessage(err) });
    }
  };

  const onTest = async () => {
    try {
      const result = await test.mutateAsync();
      toast({ tone: 'success', title: 'Conexão funcionando', description: `Testado com o tipo: ${result.testedKind}` });
    } catch (err) {
      toast({ tone: 'error', title: 'Falha na conexão', description: extractErrorMessage(err) });
    }
  };

  const onRemove = async () => {
    try {
      await remove.mutateAsync();
      toast({ tone: 'success', title: 'Provedor desconectado' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao remover', description: extractErrorMessage(err) });
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Provedor de Dados Pessoais (CPF · Telefone · Score · Parentes)</CardTitle>
        {status?.configured && <Badge tone="success">Conectado — {PROVIDER_LABELS[status.provider]}</Badge>}
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-slate-500">
          Cada organização usa o bureau de crédito que ela mesma contratou (Serasa, Boa Vista, Big Data Corp,
          Assertiva, Quod, ou uma API própria). Sem essa configuração, as consultas de CPF, telefone, score e
          parentes continuam em <strong>modo demonstração</strong> — a consulta de CNPJ não é afetada, ela já é real
          (Receita Federal/BrasilAPI) independentemente disso.
        </p>

        {isLoading ? (
          <Spinner />
        ) : status?.configured ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Provedor</p>
                <p className="font-medium text-slate-800">{PROVIDER_LABELS[status.provider]}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Base URL</p>
                <p className="break-all font-medium text-slate-800">{status.baseUrl}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Chave</p>
                <p className="font-medium text-slate-800">••••{status.apiKeySuffix}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Atualizado em</p>
                <p className="font-medium text-slate-800">{formatDateTime(status.updatedAt)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={status.cpfConfigured ? 'success' : 'default'}>
                CPF {status.cpfConfigured ? 'real' : 'demo'}
              </Badge>
              <Badge tone={status.phoneConfigured ? 'success' : 'default'}>
                Telefone {status.phoneConfigured ? 'real' : 'demo'}
              </Badge>
              <Badge tone={status.creditScoreConfigured ? 'success' : 'default'}>
                Score {status.creditScoreConfigured ? 'real' : 'demo'}
              </Badge>
              <Badge tone={status.relativesConfigured ? 'success' : 'default'}>
                Parentes {status.relativesConfigured ? 'real' : 'demo'}
              </Badge>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onTest} loading={test.isPending}>
                  Testar conexão
                </Button>
                <Button size="sm" variant="destructive" onClick={onRemove} loading={remove.isPending}>
                  <Unlink className="h-4 w-4" /> Desconectar
                </Button>
              </div>
            )}
          </div>
        ) : isAdmin ? (
          <form onSubmit={onSave} className="space-y-4">
            <div>
              <Label>Provedor</Label>
              <Select value={form.provider} onChange={(e) => set('provider', e.target.value as PersonalDataProviderName)}>
                {PERSONAL_DATA_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Base URL da API</Label>
              <Input
                required
                placeholder="https://api.provedor.com.br/v1"
                value={form.baseUrl}
                onChange={(e) => set('baseUrl', e.target.value)}
              />
            </div>
            <div>
              <Label>Chave de API</Label>
              <Input
                required
                type="password"
                placeholder="Fornecida pelo provedor contratado"
                value={form.apiKey}
                onChange={(e) => set('apiKey', e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex items-center gap-1 text-sm font-medium text-brand-600"
            >
              {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Configuração avançada (caminhos de cada consulta)
            </button>

            {advancedOpen && (
              <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs text-slate-500">
                  Use <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{'{documento}'}</code> onde o
                  CPF/telefone consultado deve entrar na URL. Deixe em branco o que essa organização ainda não
                  contratou — esse tipo de consulta continua em modo demonstração.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Header de autenticação</Label>
                    <Input value={form.authHeaderName} onChange={(e) => set('authHeaderName', e.target.value)} />
                  </div>
                  <div>
                    <Label>Prefixo do header (esquema)</Label>
                    <Input
                      placeholder="Bearer (ou deixe em branco)"
                      value={form.authScheme}
                      onChange={(e) => set('authScheme', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Caminho da consulta de CPF</Label>
                  <Input
                    placeholder="/pessoas/{documento}"
                    value={form.cpfPath}
                    onChange={(e) => set('cpfPath', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Caminho da consulta de telefone</Label>
                  <Input
                    placeholder="/telefones/{documento}"
                    value={form.phonePath}
                    onChange={(e) => set('phonePath', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Caminho da consulta de score de crédito</Label>
                  <Input
                    placeholder="/pessoas/{documento}/score"
                    value={form.creditScorePath}
                    onChange={(e) => set('creditScorePath', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Caminho da consulta de vínculos/parentes</Label>
                  <Input
                    placeholder="/pessoas/{documento}/vinculos"
                    value={form.relativesPath}
                    onChange={(e) => set('relativesPath', e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button type="submit" loading={save.isPending}>
              Conectar
            </Button>
          </form>
        ) : (
          <Alert tone="info">Peça a um administrador da organização para conectar um provedor de dados pessoais.</Alert>
        )}
      </CardContent>
    </Card>
  );
}
