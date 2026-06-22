-- AlterTable
ALTER TABLE "Drug"
ADD COLUMN "slug" TEXT,
ADD COLUMN "genericName" TEXT,
ADD COLUMN "brandName" TEXT,
ADD COLUMN "indication" TEXT,
ADD COLUMN "contraindications" TEXT,
ADD COLUMN "doseByAgeWeight" TEXT,
ADD COLUMN "knowledgePriority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "keywords" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "KnowledgeDisease" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT,
    "definition" TEXT NOT NULL DEFAULT '',
    "severityLevel" TEXT NOT NULL DEFAULT 'ROUTINE',
    "selfCareAdvice" TEXT NOT NULL DEFAULT '',
    "redFlagAdvice" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDisease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSymptom" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT,
    "observationGuide" TEXT NOT NULL DEFAULT '',
    "firstAid" TEXT NOT NULL DEFAULT '',
    "dangerLevel" TEXT NOT NULL DEFAULT 'LOW',
    "redFlag" BOOLEAN NOT NULL DEFAULT false,
    "keywords" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSymptom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseaseSymptomMap" (
    "id" TEXT NOT NULL,
    "diseaseId" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiseaseSymptomMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseaseDrugMap" (
    "id" TEXT NOT NULL,
    "diseaseId" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "recommendationLevel" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiseaseDrugMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymptomDrugMap" (
    "id" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "recommendationLevel" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymptomDrugMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Drug_slug_idx" ON "Drug"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDisease_slug_key" ON "KnowledgeDisease"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeDisease_nameTh_idx" ON "KnowledgeDisease"("nameTh");

-- CreateIndex
CREATE INDEX "KnowledgeDisease_nameEn_idx" ON "KnowledgeDisease"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSymptom_slug_key" ON "KnowledgeSymptom"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeSymptom_nameTh_idx" ON "KnowledgeSymptom"("nameTh");

-- CreateIndex
CREATE INDEX "KnowledgeSymptom_nameEn_idx" ON "KnowledgeSymptom"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "DiseaseSymptomMap_diseaseId_symptomId_key" ON "DiseaseSymptomMap"("diseaseId", "symptomId");

-- CreateIndex
CREATE INDEX "DiseaseSymptomMap_symptomId_diseaseId_idx" ON "DiseaseSymptomMap"("symptomId", "diseaseId");

-- CreateIndex
CREATE UNIQUE INDEX "DiseaseDrugMap_diseaseId_drugId_key" ON "DiseaseDrugMap"("diseaseId", "drugId");

-- CreateIndex
CREATE INDEX "DiseaseDrugMap_drugId_diseaseId_idx" ON "DiseaseDrugMap"("drugId", "diseaseId");

-- CreateIndex
CREATE UNIQUE INDEX "SymptomDrugMap_symptomId_drugId_key" ON "SymptomDrugMap"("symptomId", "drugId");

-- CreateIndex
CREATE INDEX "SymptomDrugMap_drugId_symptomId_idx" ON "SymptomDrugMap"("drugId", "symptomId");

-- AddForeignKey
ALTER TABLE "DiseaseSymptomMap" ADD CONSTRAINT "DiseaseSymptomMap_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "KnowledgeDisease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseSymptomMap" ADD CONSTRAINT "DiseaseSymptomMap_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "KnowledgeSymptom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseDrugMap" ADD CONSTRAINT "DiseaseDrugMap_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "KnowledgeDisease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseDrugMap" ADD CONSTRAINT "DiseaseDrugMap_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomDrugMap" ADD CONSTRAINT "SymptomDrugMap_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "KnowledgeSymptom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomDrugMap" ADD CONSTRAINT "SymptomDrugMap_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE CASCADE ON UPDATE CASCADE;
