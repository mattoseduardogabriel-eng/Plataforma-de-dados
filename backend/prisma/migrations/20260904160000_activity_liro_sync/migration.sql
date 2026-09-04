-- AlterTable: sincronização de tarefas com o Liro CRM
ALTER TABLE "activities" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "activities" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "activities_externalId_key" ON "activities"("externalId");
