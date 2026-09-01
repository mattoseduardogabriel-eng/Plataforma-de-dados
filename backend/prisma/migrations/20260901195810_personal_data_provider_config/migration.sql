-- CreateTable
CREATE TABLE "personal_data_provider_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "authHeaderName" TEXT NOT NULL DEFAULT 'Authorization',
    "authScheme" TEXT NOT NULL DEFAULT 'Bearer',
    "cpfPath" TEXT,
    "phonePath" TEXT,
    "creditScorePath" TEXT,
    "relativesPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_data_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_data_provider_configs_organizationId_key" ON "personal_data_provider_configs"("organizationId");

-- AddForeignKey
ALTER TABLE "personal_data_provider_configs" ADD CONSTRAINT "personal_data_provider_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
