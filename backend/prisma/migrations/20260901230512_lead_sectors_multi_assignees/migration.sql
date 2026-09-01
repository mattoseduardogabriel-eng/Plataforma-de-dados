-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "liroOperatorName" TEXT,
ADD COLUMN     "sectorId" TEXT;

-- CreateTable
CREATE TABLE "organization_sectors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignees" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_sectors_organizationId_name_key" ON "organization_sectors"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "lead_assignees_leadId_userId_key" ON "lead_assignees"("leadId", "userId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "organization_sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_sectors" ADD CONSTRAINT "organization_sectors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignees" ADD CONSTRAINT "lead_assignees_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignees" ADD CONSTRAINT "lead_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
