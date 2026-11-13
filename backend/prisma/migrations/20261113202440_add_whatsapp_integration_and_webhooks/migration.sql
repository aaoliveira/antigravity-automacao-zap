-- CreateEnum
CREATE TYPE "WhatsAppProviderType" AS ENUM ('BAILEYS', 'CLOUD_API');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "lastInteractionAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "outbox_messages" ADD COLUMN     "providerMessageId" VARCHAR(100),
ADD COLUMN     "providerResponse" JSONB;

-- AlterTable
ALTER TABLE "whatsapp_instances" ADD COLUMN     "apiKeyEncrypted" TEXT,
ADD COLUMN     "capabilities" JSONB,
ADD COLUMN     "providerType" "WhatsAppProviderType" NOT NULL DEFAULT 'BAILEYS',
ADD COLUMN     "serverUrl" VARCHAR(255),
ADD COLUMN     "webhookSecret" VARCHAR(255);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "instanceId" UUID,
    "instanceName" VARCHAR(100) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "externalId" VARCHAR(100),
    "payload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_events_tenantId_createdAt_idx" ON "webhook_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_events_externalId_idx" ON "webhook_events"("externalId");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "whatsapp_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
