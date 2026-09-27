-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "public"."Category"("name");

-- Default categories (replace the old hardcoded English keys)
INSERT INTO "public"."Category" ("id", "name") VALUES
    (gen_random_uuid()::text, 'Comida'),
    (gen_random_uuid()::text, 'Casa'),
    (gen_random_uuid()::text, 'Transporte'),
    (gen_random_uuid()::text, 'Servicios'),
    (gen_random_uuid()::text, 'Ocio'),
    (gen_random_uuid()::text, 'Otros');

-- Keep any other category string already in use as its own category
INSERT INTO "public"."Category" ("id", "name")
SELECT gen_random_uuid()::text, "category"
FROM "public"."Expense"
WHERE "category" NOT IN ('food', 'house', 'transport', 'utilities', 'entertainment', 'other')
GROUP BY "category"
ON CONFLICT ("name") DO NOTHING;

-- Move expenses from the category string to the Category relation
ALTER TABLE "public"."Expense" ADD COLUMN "categoryId" TEXT;

UPDATE "public"."Expense" e
SET "categoryId" = c."id"
FROM "public"."Category" c
WHERE c."name" = CASE e."category"
    WHEN 'food' THEN 'Comida'
    WHEN 'house' THEN 'Casa'
    WHEN 'transport' THEN 'Transporte'
    WHEN 'utilities' THEN 'Servicios'
    WHEN 'entertainment' THEN 'Ocio'
    WHEN 'other' THEN 'Otros'
    ELSE e."category"
END;

ALTER TABLE "public"."Expense" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "public"."Expense" DROP COLUMN "category";

-- Money as exact decimal, date without time (avoids timezone day shifts)
ALTER TABLE "public"."Expense" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "public"."Expense" ALTER COLUMN "date" SET DATA TYPE DATE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
