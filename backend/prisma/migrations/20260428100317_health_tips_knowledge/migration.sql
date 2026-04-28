-- CreateTable
CREATE TABLE "KnowledgeHealthTip" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleTh" TEXT NOT NULL,
    "titleEn" TEXT,
    "summaryTh" TEXT NOT NULL DEFAULT '',
    "summaryEn" TEXT NOT NULL DEFAULT '',
    "contentMdTh" TEXT NOT NULL DEFAULT '',
    "contentMdEn" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "coverImageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeHealthTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeHealthTipReference" (
    "id" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT,
    "accessedAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeHealthTipReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeHealthTip_slug_key" ON "KnowledgeHealthTip"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeHealthTip_titleTh_idx" ON "KnowledgeHealthTip"("titleTh");

-- CreateIndex
CREATE INDEX "KnowledgeHealthTip_titleEn_idx" ON "KnowledgeHealthTip"("titleEn");

-- CreateIndex
CREATE INDEX "KnowledgeHealthTipReference_tipId_idx" ON "KnowledgeHealthTipReference"("tipId");

-- AddForeignKey
ALTER TABLE "KnowledgeHealthTipReference" ADD CONSTRAINT "KnowledgeHealthTipReference_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "KnowledgeHealthTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
