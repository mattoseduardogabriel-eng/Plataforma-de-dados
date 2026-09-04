-- Alerta de falha persistente na sincronização de TAREFAS com o Liro CRM
-- (contador por push falhado, não por rodada de cron — a sincronização
-- de tarefas é orientada a evento).
ALTER TABLE "organizations" ADD COLUMN "liroCrmTaskSyncFailureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN "liroCrmTaskSyncLastError" TEXT;
