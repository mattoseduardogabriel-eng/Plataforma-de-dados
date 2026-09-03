-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "liroContactId" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "liroContactId" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "liroCrmApiKeyEncrypted" TEXT,
ADD COLUMN     "liroCrmBaseUrl" TEXT,
ADD COLUMN     "liroCrmLastSyncedAt" TIMESTAMP(3);
