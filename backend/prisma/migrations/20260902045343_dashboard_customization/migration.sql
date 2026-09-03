-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "monthlyGoalCents" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hiddenDashboardWidgets" TEXT[] DEFAULT ARRAY[]::TEXT[];
