-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_alertId_fkey";

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "targetCrops" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'ALERT',
ADD COLUMN     "refId" TEXT,
ALTER COLUMN "alertId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "sownAt" DATE;

-- AlterTable
ALTER TABLE "PestReport" ADD COLUMN     "photo" BYTEA,
ADD COLUMN     "photoMime" TEXT;

-- CreateTable
CREATE TABLE "StepReminder" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "due" DATE NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "StepReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingShare" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,

    CONSTRAINT "ListingShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "items" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StepReminder_parcelId_code_key" ON "StepReminder"("parcelId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ListingShare_listingId_producerId_key" ON "ListingShare"("listingId", "producerId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_kind_refId_userId_key" ON "Notification"("kind", "refId", "userId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepReminder" ADD CONSTRAINT "StepReminder_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingShare" ADD CONSTRAINT "ListingShare_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

