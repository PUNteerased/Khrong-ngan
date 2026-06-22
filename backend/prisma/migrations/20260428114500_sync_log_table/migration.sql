-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "operatorUserId" TEXT,
    "operatorUsername" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" JSONB,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt" DESC);
