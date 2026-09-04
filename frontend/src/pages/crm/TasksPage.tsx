import { useState } from 'react';
import { Plus, Phone, Users2, Mail, FileText, ListChecks, StickyNote, Check, Trash2, Link2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Input, Label, Select, Textarea, Alert, Badge, Spinner, EmptyState } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/dialog';
import { useTasks, useCreateActivity, useMarkActivityDone, useDeleteActivity, useDeleteCompletedActivities } from '@/hooks/useCrm';
import { useOrgUsers } from '@/hooks/useUsers';
import { useAuth } from '@/lib/auth-context';
import { extractErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Activity, ActivityType } from '@/types';

const TYPE_ICON: Record<ActivityType, typeof Phone> = {
  LIGACAO: Phone,
  REUNIAO: Users2,
  EMAIL: Mail,
  PROPOSTA: FileText,
  TAREFA: ListChecks,
  NOTA: StickyNote,
};

function NewTaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createActivity = useCreateActivity();
  const { data: users } = useOrgUsers();
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState({
    type: 'TAREFA' as ActivityType,
    title: '',
    notes: '',
    dueDate: '',
    assignedToId: currentUser?.id ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createActivity.mutateAsync({
        type: form.type,
        title: form.title,
        notes: form.notes || undefined,
        dueDate: form.dueDate || undefined,
        assignedToId: form.assignedToId || undefined,
      });
      setForm({ type: 'TAREFA', title: '', notes: '', dueDate: '', assignedToId: currentUser?.id ?? '' });
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível criar a tarefa.'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Nova tarefa">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div>
          <Label htmlFor="taskTitle">Título</Label>
          <Input
            id="taskTitle"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ex.: Ligar pra confirmar instalação"
          />
        </div>
        <div>
          <Label htmlFor="taskType">Tipo</Label>
          <Select id="taskType" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ActivityType }))}>
            <option value="TAREFA">Tarefa</option>
            <option value="LIGACAO">Ligação</option>
            <option value="REUNIAO">Reunião</option>
            <option value="EMAIL">E-mail</option>
            <option value="PROPOSTA">Proposta</option>
            <option value="NOTA">Nota</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="taskAssignee">Responsável</Label>
          <Select id="taskAssignee" value={form.assignedToId} onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="taskDueDate">Prazo (opcional)</Label>
          <Input id="taskDueDate" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="taskNotes">Notas (opcional)</Label>
          <Textarea id="taskNotes" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={createActivity.isPending}>Criar tarefa</Button>
        </div>
      </form>
    </Dialog>
  );
}

function TaskRow({ task }: { task: Activity }) {
  const markDone = useMarkActivityDone();
  const deleteActivity = useDeleteActivity();
  const Icon = TYPE_ICON[task.type];
  const isDone = !!task.doneAt;
  const isOverdue = !isDone && task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div className={cn('flex items-start gap-3 border-b border-slate-100 py-3 last:border-0', isDone && 'opacity-50')}>
      <button
        type="button"
        onClick={() => !isDone && markDone.mutate(task.id)}
        disabled={isDone || markDone.isPending}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          isDone ? 'border-emerald-400 bg-emerald-400 text-white' : 'border-slate-300 hover:border-brand-400',
        )}
        title={isDone ? 'Concluída' : 'Marcar como concluída'}
      >
        {isDone && <Check className="h-3 w-3" />}
      </button>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className={cn('flex items-center gap-1.5 text-sm font-medium text-slate-800', isDone && 'line-through')}>
          {task.title}
          {task.origin === 'liro' && (
            <span title="Sincronizada do Liro CRM" className="text-slate-400">
              <Link2 className="h-3 w-3" />
            </span>
          )}
        </p>
        {task.notes && <p className="text-xs text-slate-500">{task.notes}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {task.assignedTo && <span>Responsável: {task.assignedTo.name}</span>}
          {task.lead && <span>· Lead: {task.lead.name}</span>}
          {task.deal && <span>· Negócio: {task.deal.title}</span>}
        </div>
      </div>
      {task.dueDate && (
        <Badge tone={isOverdue ? 'danger' : 'neutral'}>{formatDate(task.dueDate)}</Badge>
      )}
      {isDone && (
        <button
          type="button"
          onClick={() => deleteActivity.mutate(task.id)}
          disabled={deleteActivity.isPending}
          className="mt-0.5 shrink-0 text-slate-300 hover:text-red-500"
          title="Excluir tarefa"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function TasksPage() {
  const { user: currentUser } = useAuth();
  const canSeeAll = currentUser?.role === 'ADMIN' || currentUser?.role === 'GESTOR';
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const { data: tasks, isLoading } = useTasks(scope === 'mine' ? { assignedToId: currentUser?.id } : {});
  const [createOpen, setCreateOpen] = useState(false);
  const deleteCompleted = useDeleteCompletedActivities();
  const temConcluidas = tasks?.some((t) => !!t.doneAt) ?? false;

  const handleClearCompleted = () => {
    if (!window.confirm('Excluir todas as tarefas concluídas desta lista? Não dá pra desfazer.')) return;
    deleteCompleted.mutate(scope === 'mine' ? currentUser?.id : undefined);
  };

  return (
    <div>
      <PageHeader title="Tarefas" description="Suas atividades e tarefas pendentes no CRM" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {canSeeAll ? (
          <div className="inline-flex rounded-full border border-slate-300 p-0.5">
            <button
              className={cn('rounded-full px-3 py-1 text-sm font-medium', scope === 'mine' ? 'bg-brand-500 text-slate-50' : 'text-slate-600')}
              onClick={() => setScope('mine')}
            >
              Minhas
            </button>
            <button
              className={cn('rounded-full px-3 py-1 text-sm font-medium', scope === 'all' ? 'bg-brand-500 text-slate-50' : 'text-slate-600')}
              onClick={() => setScope('all')}
            >
              Todas da equipe
            </button>
          </div>
        ) : <div />}
        <div className="flex items-center gap-2">
          {temConcluidas && (
            <Button variant="outline" size="sm" onClick={handleClearCompleted} loading={deleteCompleted.isPending}>
              <Trash2 className="h-3.5 w-3.5" /> Limpar concluídas
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
        </div>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <Spinner />
        ) : !tasks?.length ? (
          <EmptyState title="Nenhuma tarefa" description="Crie uma tarefa nova ou aguarde ser atribuído a alguma." />
        ) : (
          tasks.map((task) => <TaskRow key={task.id} task={task} />)
        )}
      </Card>

      <NewTaskDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
