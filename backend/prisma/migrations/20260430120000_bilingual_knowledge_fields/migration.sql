-- AlterTable
ALTER TABLE "KnowledgeDisease" ADD COLUMN "definitionEn" TEXT;
ALTER TABLE "KnowledgeDisease" ADD COLUMN "selfCareEn" TEXT;
ALTER TABLE "KnowledgeDisease" ADD COLUMN "redFlagEn" TEXT;

-- AlterTable
ALTER TABLE "KnowledgeSymptom" ADD COLUMN "observationEn" TEXT;

-- AlterTable
ALTER TABLE "Drug" ADD COLUMN "brandNameEn" TEXT;
ALTER TABLE "Drug" ADD COLUMN "indicationEn" TEXT;
ALTER TABLE "Drug" ADD COLUMN "doseEn" TEXT;
