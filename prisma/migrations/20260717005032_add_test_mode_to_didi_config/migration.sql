-- AlterTable
ALTER TABLE "didi_config" ADD COLUMN     "test_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "test_shops" TEXT[];
