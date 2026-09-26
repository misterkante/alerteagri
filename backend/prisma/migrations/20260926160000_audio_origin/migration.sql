-- CreateEnum
CREATE TYPE "AudioOrigin" AS ENUM ('RECORDED', 'SYNTHETIC');

-- AlterTable
ALTER TABLE "ContentAudio" ADD COLUMN     "machineTranslated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origin" "AudioOrigin" NOT NULL DEFAULT 'RECORDED',
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "transcript" TEXT;

