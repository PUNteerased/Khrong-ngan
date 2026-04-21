-- Additional medical profile fields so the AI can ask the user to fill them via chat.
ALTER TABLE "User" ADD COLUMN "height" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "gender" TEXT;
ALTER TABLE "User" ADD COLUMN "currentMedications" TEXT NOT NULL DEFAULT '';
