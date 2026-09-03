import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { BackofficeRoute } from '@/components/layout/BackofficeRoute';
import { Spinner } from '@/components/ui/primitives';

// Cada página vira o próprio chunk (import dinâmico) — sem isso, o
// bundle inteiro (CRM + Financeiro + Pós-venda + Inteligência de Dados +
// Crivo + Relatórios + Backoffice, tudo junto) carregava de uma vez só
// no primeiro acesso, mesmo pra quem só usa uma dessas áreas. O Suspense
// abaixo mostra um spinner enquanto o chunk da rota clicada baixa (rápido
// depois da primeira vez — o navegador cacheia).
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const BackofficeOrganizationsPage = lazy(() =>
  import('@/pages/backoffice/OrganizationsPage').then((m) => ({ default: m.OrganizationsPage })),
);
const RegisterOrganizationPage = lazy(() =>
  import('@/pages/RegisterOrganizationPage').then((m) => ({ default: m.RegisterOrganizationPage })),
);
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const PipelinePage = lazy(() => import('@/pages/crm/PipelinePage').then((m) => ({ default: m.PipelinePage })));
const LeadsPage = lazy(() => import('@/pages/crm/LeadsPage').then((m) => ({ default: m.LeadsPage })));
const LeadDetailPage = lazy(() => import('@/pages/crm/LeadDetailPage').then((m) => ({ default: m.LeadDetailPage })));
const OpenLeadByPhonePage = lazy(() =>
  import('@/pages/crm/OpenLeadByPhonePage').then((m) => ({ default: m.OpenLeadByPhonePage })),
);
const DealDetailPage = lazy(() => import('@/pages/crm/DealDetailPage').then((m) => ({ default: m.DealDetailPage })));
const TeamPage = lazy(() => import('@/pages/crm/TeamPage').then((m) => ({ default: m.TeamPage })));
const TasksPage = lazy(() => import('@/pages/crm/TasksPage').then((m) => ({ default: m.TasksPage })));
const CashFlowPage = lazy(() => import('@/pages/financial/CashFlowPage').then((m) => ({ default: m.CashFlowPage })));
const TransactionsPage = lazy(() =>
  import('@/pages/financial/TransactionsPage').then((m) => ({ default: m.TransactionsPage })),
);
const CustomersPage = lazy(() => import('@/pages/post-sale/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const CustomerDetailPage = lazy(() =>
  import('@/pages/post-sale/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })),
);
const CnpjQueryPage = lazy(() =>
  import('@/pages/data-intelligence/CnpjQueryPage').then((m) => ({ default: m.CnpjQueryPage })),
);
const CpfQueryPage = lazy(() =>
  import('@/pages/data-intelligence/CpfQueryPage').then((m) => ({ default: m.CpfQueryPage })),
);
const PhoneQueryPage = lazy(() =>
  import('@/pages/data-intelligence/PhoneQueryPage').then((m) => ({ default: m.PhoneQueryPage })),
);
const CreditScoreQueryPage = lazy(() =>
  import('@/pages/data-intelligence/CreditScoreQueryPage').then((m) => ({ default: m.CreditScoreQueryPage })),
);
const RelativesQueryPage = lazy(() =>
  import('@/pages/data-intelligence/RelativesQueryPage').then((m) => ({ default: m.RelativesQueryPage })),
);
const HistoryPage = lazy(() =>
  import('@/pages/data-intelligence/HistoryPage').then((m) => ({ default: m.HistoryPage })),
);
const CrivoEvaluatePage = lazy(() =>
  import('@/pages/crivo/CrivoEvaluatePage').then((m) => ({ default: m.CrivoEvaluatePage })),
);
const PoliciesPage = lazy(() => import('@/pages/crivo/PoliciesPage').then((m) => ({ default: m.PoliciesPage })));
const CrossReferencePage = lazy(() =>
  import('@/pages/reports/CrossReferencePage').then((m) => ({ default: m.CrossReferencePage })),
);
const ReportDetailPage = lazy(() =>
  import('@/pages/reports/ReportDetailPage').then((m) => ({ default: m.ReportDetailPage })),
);
const AuditLogPage = lazy(() => import('@/pages/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registrar" element={<RegisterOrganizationPage />} />

        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

        <Route path="/backoffice" element={<BackofficeRoute><BackofficeOrganizationsPage /></BackofficeRoute>} />

        <Route path="/crm/funil" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
        <Route path="/crm/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
        <Route path="/crm/leads/:id" element={<ProtectedRoute><LeadDetailPage /></ProtectedRoute>} />
        {/* Deep-link "Abrir no Aster" clicado de dentro de uma conversa do Liro CRM — resolve ?phone= e navega pro lead. */}
        <Route path="/crm/leads/open" element={<ProtectedRoute><OpenLeadByPhonePage /></ProtectedRoute>} />
        <Route path="/crm/deals/:id" element={<ProtectedRoute><DealDetailPage /></ProtectedRoute>} />
        <Route path="/crm/equipe" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
        <Route path="/tarefas" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />

        <Route path="/financeiro" element={<ProtectedRoute><CashFlowPage /></ProtectedRoute>} />
        <Route path="/financeiro/lancamentos" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />

        <Route path="/pos-venda" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
        <Route path="/pos-venda/:id" element={<ProtectedRoute><CustomerDetailPage /></ProtectedRoute>} />

        <Route path="/consultas/cnpj" element={<ProtectedRoute><CnpjQueryPage /></ProtectedRoute>} />
        <Route path="/consultas/cpf" element={<ProtectedRoute><CpfQueryPage /></ProtectedRoute>} />
        <Route path="/consultas/telefone" element={<ProtectedRoute><PhoneQueryPage /></ProtectedRoute>} />
        <Route path="/consultas/credito" element={<ProtectedRoute><CreditScoreQueryPage /></ProtectedRoute>} />
        <Route path="/consultas/parentes" element={<ProtectedRoute><RelativesQueryPage /></ProtectedRoute>} />
        <Route path="/consultas/historico" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />

        <Route path="/crivo" element={<ProtectedRoute><CrivoEvaluatePage /></ProtectedRoute>} />
        <Route path="/crivo/politicas" element={<ProtectedRoute><PoliciesPage /></ProtectedRoute>} />

        <Route path="/relatorios" element={<ProtectedRoute><CrossReferencePage /></ProtectedRoute>} />
        <Route path="/relatorios/:id" element={<ProtectedRoute><ReportDetailPage /></ProtectedRoute>} />

        <Route path="/auditoria" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      </Routes>
    </Suspense>
  );
}
