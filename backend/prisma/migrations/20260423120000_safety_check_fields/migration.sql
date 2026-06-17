-- Safety check fields
-- Normalized allergy keywords for strict matching against drug ingredients
ALTER TABLE "User" ADD COLUMN "allergyKeywords" TEXT NOT NULL DEFAULT '';

-- Comma-separated active ingredients used by the backend SafetyCheck utility
ALTER TABLE "Drug" ADD COLUMN "ingredientsText" TEXT NOT NULL DEFAULT '';
