-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "liroWebhookToken" TEXT;

-- AlterTable
ALTER TABLE "pipeline_stages" ADD COLUMN     "liroKanbanStageId" TEXT,
ADD COLUMN     "liroKanbanStageName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_liroWebhookToken_key" ON "organizations"("liroWebhookToken");
