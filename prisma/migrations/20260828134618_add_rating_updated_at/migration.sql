-- Ratings became revisable: a citizen may change their vote and trust flag on a
-- candidate, and the existing row is updated in place rather than duplicated.
-- `updatedAt` is what lets a surface say when the standing answer was last
-- changed, and — by comparing it to `createdAt` — whether it was changed at all.

-- AlterTable
ALTER TABLE "flags" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "votes" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Rows that predate the column were never revised, so they must read as
-- unchanged. Taking the column default instead would stamp every historical
-- rating with the migration's own timestamp and report the whole table as
-- edited at the moment of deploy.
UPDATE "flags" SET "updatedAt" = "createdAt";
UPDATE "votes" SET "updatedAt" = "createdAt";
