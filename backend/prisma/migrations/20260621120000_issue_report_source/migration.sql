-- AlterTable
ALTER TABLE "IssueReport" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'contact';

-- CreateIndex
CREATE INDEX "IssueReport_source_createdAt_idx" ON "IssueReport"("source", "createdAt" DESC);
