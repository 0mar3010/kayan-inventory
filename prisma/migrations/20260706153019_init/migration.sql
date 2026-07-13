-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "SourceSystem" AS ENUM ('LOCAL_EXCEL', 'SHOPIFY');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('AUTO', 'MANUAL', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('PENDING', 'RUNNING', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SALES', 'ADMIN');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "arabicName" TEXT NOT NULL,
    "englishName" TEXT,
    "brand" TEXT NOT NULL,
    "category" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandPrefix" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,

    CONSTRAINT "BrandPrefix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductIdentifier" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" "SourceSystem" NOT NULL,
    "rawExternalId" TEXT NOT NULL,
    "normalizedId" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySnapshot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" "SourceSystem" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rowsTotal" INTEGER NOT NULL DEFAULT 0,
    "rowsAutoMatched" INTEGER NOT NULL DEFAULT 0,
    "rowsFlagged" INTEGER NOT NULL DEFAULT 0,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredBy" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRunItem" (
    "id" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "rawRowData" JSONB NOT NULL,
    "matchStatus" "MatchStatus" NOT NULL,
    "matchedProductId" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "oldQuantity" INTEGER,
    "newQuantity" INTEGER,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SyncRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'SALES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE UNIQUE INDEX "BrandPrefix_brand_prefix_key" ON "BrandPrefix"("brand", "prefix");

-- CreateIndex
CREATE INDEX "ProductIdentifier_normalizedId_idx" ON "ProductIdentifier"("normalizedId");

-- CreateIndex
CREATE INDEX "ProductIdentifier_productId_idx" ON "ProductIdentifier"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIdentifier_source_rawExternalId_key" ON "ProductIdentifier"("source", "rawExternalId");

-- CreateIndex
CREATE INDEX "InventorySnapshot_productId_recordedAt_idx" ON "InventorySnapshot"("productId", "recordedAt");

-- CreateIndex
CREATE INDEX "SyncRunItem_syncRunId_idx" ON "SyncRunItem"("syncRunId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRunItem" ADD CONSTRAINT "SyncRunItem_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRunItem" ADD CONSTRAINT "SyncRunItem_matchedProductId_fkey" FOREIGN KEY ("matchedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

