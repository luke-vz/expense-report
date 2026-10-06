-- AlterTable
ALTER TABLE "PendingExpense" ADD COLUMN     "aiStatus" TEXT,
ADD COLUMN     "suggestedAmount" DECIMAL(12,2),
ADD COLUMN     "suggestedCategoryId" TEXT,
ADD COLUMN     "suggestedCurrency" TEXT,
ADD COLUMN     "suggestedDate" DATE,
ADD COLUMN     "suggestedInstallments" INTEGER,
ADD COLUMN     "suggestedTitle" TEXT;
