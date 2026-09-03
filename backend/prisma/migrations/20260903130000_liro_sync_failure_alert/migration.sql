-- Contador de rodadas SEGUIDAS do sync automático que falharam (zera a
-- cada sucesso) e a última mensagem de erro — usado pra alertar sobre
-- falha persistente sem alarme por instabilidade isolada.
ALTER TABLE "Organization" ADD COLUMN "liroCrmSyncFailureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN "liroCrmLastSyncError" TEXT;
