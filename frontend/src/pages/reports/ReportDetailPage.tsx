import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '@/components/ui/primitives';
import { useReport } from '@/hooks/useReports';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatDocument } from '@/lib/utils';

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="scrollbar-thin max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading } = useReport(id);
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const onExport = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const response = await api.get(`/reports/${id}/export.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${id}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao exportar CSV', description: extractErrorMessage(err) });
    } finally {
      setExporting(false);
    }
  };

  if (isLoading || !report) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={report.title}
        description={`${report.targetType}: ${formatDocument(report.targetDocument)}`}
        actions={
          <Button variant="outline" onClick={onExport} loading={exporting}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Dados internos (CRM, Financeiro, Pós-venda)</CardTitle></CardHeader>
          <CardContent>
            <JsonBlock data={report.summaryJson.internal} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Dados externos (conectores)</CardTitle></CardHeader>
          <CardContent>
            <JsonBlock data={report.summaryJson.external} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
