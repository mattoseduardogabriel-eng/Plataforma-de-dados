-- AlterTable
ALTER TABLE "organization_sectors" ADD COLUMN     "disabledFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "enabledFeatures" TEXT[] DEFAULT ARRAY['crm', 'financeiro', 'pos_venda', 'consulta_cnpj', 'consulta_cpf', 'consulta_telefone', 'consulta_credito', 'consulta_parentes', 'crivo', 'relatorios_cruzamento', 'integracao_liro_crm']::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "disabledFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "liroOperatorId" TEXT,
ADD COLUMN     "sectorId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "organization_sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
