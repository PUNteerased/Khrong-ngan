-- Image URL fields (stored as Supabase Storage public URLs)
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "Drug" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "imageUrl" TEXT;
