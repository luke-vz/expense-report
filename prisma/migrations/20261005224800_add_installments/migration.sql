-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "installmentCount" INTEGER,
ADD COLUMN     "installmentGroupId" TEXT,
ADD COLUMN     "installmentNumber" INTEGER;

-- CreateIndex
CREATE INDEX "Expense_installmentGroupId_idx" ON "Expense"("installmentGroupId");
