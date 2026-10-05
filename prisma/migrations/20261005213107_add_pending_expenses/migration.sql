-- CreateTable
CREATE TABLE "PendingExpense" (
    "id" TEXT NOT NULL,
    "photoKey" TEXT,
    "amount" DECIMAL(12,2),
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingExpense_pkey" PRIMARY KEY ("id")
);
