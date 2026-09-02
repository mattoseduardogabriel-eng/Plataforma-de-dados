import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { BackofficeRoute } from '@/components/layout/BackofficeRoute';
import { LoginPage } from '@/pages/LoginPage';
import { OrganizationsPage as BackofficeOrganizationsPage } from '@/pages/backoffice/OrganizationsPage';
import { RegisterOrganizationPage } from '@/pages/RegisterOrganizationPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PipelinePage } from '@/pages/crm/PipelinePage';
import { LeadsPage } from '@/pages/crm/LeadsPage';
import { LeadDetailPage } from '@/pages/crm/LeadDetailPage';
import { DealDetailPage } from '@/pages/crm/DealDetailPage';
import { TeamPage } from '@/pages/crm/TeamPage';
import { TasksPage } from '@/pages/crm/TasksPage';
import { CashFlowPage } from '@/pages/financial/CashFlowPage';
import { TransactionsPage } from '@/pages/financial/TransactionsPage';
import { CustomersPage } from '@/pages/post-sale/CustomersPage';
import { CustomerDetailPage } from '@/pages/post-sale/CustomerDetailPage';
import { CnpjQueryPage } from '@/pages/data-intelligence/CnpjQueryPage';
import { CpfQueryPage } from '@/pages/data-intelligence/CpfQueryPage';
import { PhoneQueryPage } from '@/pages/data-intelligence/PhoneQueryPage';
import { CreditScoreQueryPage } from '@/pages/data-intelligence/CreditScoreQueryPage';
import { RelativesQueryPage } from '@/pages/data-intelligence/RelativesQueryPage';
import { HistoryPage } from '@/pages/data-intelligence/HistoryPage';
import { CrivoEvaluatePage } from '@/pages/crivo/CrivoEvaluatePage';
import { PoliciesPage } from '@/pages/crivo/PoliciesPage';
import { CrossReferencePage } from '@/pages/reports/CrossReferencePage';
import { ReportDetailPage } from '@/pages/reports/ReportDetailPage';
import { AuditLogPage } from '@/pages/audit/AuditLogPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registrar" element={<RegisterOrganizationPage />} />

      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

      <Route path="/backoffice" element={<BackofficeRoute><BackofficeOrganizationsPage /></BackofficeRoute>} />

      <Route path="/crm/funil" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
      <Route path="/crm/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
      <Route path="/crm/leads/:id" element={<ProtectedRoute><LeadDetailPage /></ProtectedRoute>} />
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
  );
}
