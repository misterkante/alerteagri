-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PRODUCER', 'BUYER', 'ADVISOR', 'AGENT', 'COMMUNE', 'ADMIN');

-- CreateEnum
CREATE TYPE "Zone" AS ENUM ('NORD', 'SUD');

-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('HEAVY_RAIN', 'DRY_SPELL', 'HEAT', 'DISEASE_HUMIDITY', 'PEST_CLUSTER', 'POSTHARVEST');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('FICHE_LUTTE', 'REGLEMENTATION', 'CALENDRIER');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "InputStatus" AS ENUM ('HOMOLOGATED', 'NOT_HOMOLOGATED');

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "pole" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "geoSource" TEXT NOT NULL,
    "zone" "Zone" NOT NULL,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cashCrop" BOOLEAN NOT NULL DEFAULT false,
    "exportBanned" BOOLEAN NOT NULL DEFAULT false,
    "yieldKgPerHa" INTEGER NOT NULL,
    "aflatoxinRisk" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropWindow" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "zone" "Zone" NOT NULL,
    "season" INTEGER NOT NULL,
    "startMmDd" TEXT NOT NULL,
    "endMmDd" TEXT NOT NULL,

    CONSTRAINT "CropWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PRODUCER',
    "communeId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actingForId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherDaily" (
    "id" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rainMm" DOUBLE PRECISION NOT NULL,
    "tmaxC" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION NOT NULL,
    "et0Mm" DOUBLE PRECISION NOT NULL,
    "isForecast" BOOLEAN NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "communes" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "WeatherRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "label" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "neighborKm" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "communeId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "cropId" TEXT,
    "measured" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "firstSignalAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "action" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PestReport" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "actingForId" TEXT,
    "communeId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "symptom" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PestReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pictogram" TEXT NOT NULL,
    "officialRef" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAudio" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InputProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "status" "InputStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "alternative" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InputProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Harvest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "harvestDate" DATE NOT NULL,
    "advice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Harvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferencePrice" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "pricePerKg" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReferencePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "pricePerKg" INTEGER NOT NULL,
    "forExport" BOOLEAN NOT NULL DEFAULT false,
    "exportLicense" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "fcfaPer100Kg" INTEGER NOT NULL,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxPayment" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "amountFcfa" INTEGER NOT NULL,
    "orderId" TEXT,
    "collectorId" TEXT,
    "signature" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "areaHa" DOUBLE PRECISION NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "harvestDate" DATE NOT NULL,
    "weightKg" INTEGER NOT NULL,
    "humidityPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Commune_name_key" ON "Commune"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CropWindow_cropId_zone_season_key" ON "CropWindow"("cropId", "zone", "season");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherDaily_communeId_date_key" ON "WeatherDaily"("communeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_ruleId_communeId_periodKey_key" ON "Alert"("ruleId", "communeId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_alertId_userId_key" ON "Notification"("alertId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PestReport_clientId_key" ON "PestReport"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAudio_contentId_lang_key" ON "ContentAudio"("contentId", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "InputProduct_normalized_key" ON "InputProduct"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_clientId_key" ON "Listing"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_clientId_key" ON "Order"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_communeId_cropId_key" ON "TaxRate"("communeId", "cropId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPayment_receiptId_key" ON "TaxPayment"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPayment_clientId_key" ON "TaxPayment"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPayment_orderId_key" ON "TaxPayment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_code_key" ON "Lot"("code");

-- AddForeignKey
ALTER TABLE "CropWindow" ADD CONSTRAINT "CropWindow_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherDaily" ADD CONSTRAINT "WeatherDaily_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PestReport" ADD CONSTRAINT "PestReport_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PestReport" ADD CONSTRAINT "PestReport_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAudio" ADD CONSTRAINT "ContentAudio_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferencePrice" ADD CONSTRAINT "ReferencePrice_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferencePrice" ADD CONSTRAINT "ReferencePrice_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPayment" ADD CONSTRAINT "TaxPayment_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPayment" ADD CONSTRAINT "TaxPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
