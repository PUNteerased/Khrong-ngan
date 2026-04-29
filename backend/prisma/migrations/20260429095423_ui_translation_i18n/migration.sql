-- CreateTable
CREATE TABLE "UiTranslation" (
    "id" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "en" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sourceUpdatedBy" TEXT,
    "sourceUpdatedAt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UiTranslation_namespace_isPublished_idx" ON "UiTranslation"("namespace", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "UiTranslation_namespace_key_key" ON "UiTranslation"("namespace", "key");
