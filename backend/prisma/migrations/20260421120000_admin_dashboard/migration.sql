-- Consultation severity (AI safety / escalation)
CREATE TYPE "ConsultationSeverity" AS ENUM ('ROUTINE', 'ESCALATE_HOSPITAL');

-- ChatSession extensions
ALTER TABLE "ChatSession" ADD COLUMN "severity" "ConsultationSeverity" NOT NULL DEFAULT 'ROUTINE';
ALTER TABLE "ChatSession" ADD COLUMN "redFlagReason" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN "userProfileSnapshot" JSONB;

-- Drug extensions
ALTER TABLE "Drug" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Drug" ADD COLUMN "priceCents" INTEGER;

-- Admin feedback on AI sessions
CREATE TYPE "AdminFeedbackRating" AS ENUM ('UP', 'DOWN');

CREATE TABLE "AdminSessionReview" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "adminUserId" TEXT,
    "rating" "AdminFeedbackRating" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSessionReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminSessionReview_sessionId_key" ON "AdminSessionReview"("sessionId");

ALTER TABLE "AdminSessionReview" ADD CONSTRAINT "AdminSessionReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminSessionReview" ADD CONSTRAINT "AdminSessionReview_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit trail for admin PII edits
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
