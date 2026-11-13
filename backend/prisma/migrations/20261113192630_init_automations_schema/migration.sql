-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('KEYWORD_EXACT', 'KEYWORD_CONTAINS', 'REGEX', 'FIRST_INTERACTION', 'ANY_MESSAGE', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "VariableType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('RUNNING', 'WAITING_INPUT', 'WAITING_DELAY', 'COMPLETED', 'FAILED', 'HANDOVER_HUMAN', 'PAUSED');

-- CreateEnum
CREATE TYPE "ExecutionNodeStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "AutomationStatus" NOT NULL DEFAULT 'DRAFT',
    "activeVersionId" UUID,
    "currentDraft" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_versions" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "schemaVersion" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedBy" UUID,
    "publishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_triggers" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" "TriggerType" NOT NULL DEFAULT 'KEYWORD_EXACT',
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "automation_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_variables" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "VariableType" NOT NULL DEFAULT 'STRING',
    "defaultValue" TEXT,
    "description" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flow_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_executions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "flowVersionId" UUID NOT NULL,
    "contactPhone" VARCHAR(50) NOT NULL,
    "contactName" VARCHAR(255),
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "currentNodeId" VARCHAR(100),
    "contextData" JSONB,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    "lastInteractionAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_execution_nodes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "executionId" UUID NOT NULL,
    "nodeId" VARCHAR(100) NOT NULL,
    "nodeType" VARCHAR(50) NOT NULL,
    "status" "ExecutionNodeStatus" NOT NULL DEFAULT 'PENDING',
    "inputPayload" JSONB,
    "outputPayload" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,

    CONSTRAINT "flow_execution_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_execution_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "executionId" UUID NOT NULL,
    "nodeId" VARCHAR(100),
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "automations_tenantId_idx" ON "automations"("tenantId");

-- CreateIndex
CREATE INDEX "automations_tenantId_status_idx" ON "automations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "flow_versions_tenantId_idx" ON "flow_versions"("tenantId");

-- CreateIndex
CREATE INDEX "flow_versions_automationId_idx" ON "flow_versions"("automationId");

-- CreateIndex
CREATE UNIQUE INDEX "flow_versions_automationId_versionNumber_key" ON "flow_versions"("automationId", "versionNumber");

-- CreateIndex
CREATE INDEX "automation_triggers_tenantId_idx" ON "automation_triggers"("tenantId");

-- CreateIndex
CREATE INDEX "automation_triggers_automationId_idx" ON "automation_triggers"("automationId");

-- CreateIndex
CREATE INDEX "flow_variables_tenantId_idx" ON "flow_variables"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "flow_variables_automationId_name_key" ON "flow_variables"("automationId", "name");

-- CreateIndex
CREATE INDEX "flow_executions_tenantId_contactPhone_idx" ON "flow_executions"("tenantId", "contactPhone");

-- CreateIndex
CREATE INDEX "flow_executions_automationId_status_idx" ON "flow_executions"("automationId", "status");

-- CreateIndex
CREATE INDEX "flow_execution_nodes_executionId_idx" ON "flow_execution_nodes"("executionId");

-- CreateIndex
CREATE INDEX "flow_execution_nodes_tenantId_idx" ON "flow_execution_nodes"("tenantId");

-- CreateIndex
CREATE INDEX "flow_execution_logs_executionId_createdAt_idx" ON "flow_execution_logs"("executionId", "createdAt");

-- CreateIndex
CREATE INDEX "flow_execution_logs_tenantId_idx" ON "flow_execution_logs"("tenantId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_versions" ADD CONSTRAINT "flow_versions_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_versions" ADD CONSTRAINT "flow_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_variables" ADD CONSTRAINT "flow_variables_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_variables" ADD CONSTRAINT "flow_variables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_flowVersionId_fkey" FOREIGN KEY ("flowVersionId") REFERENCES "flow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_execution_nodes" ADD CONSTRAINT "flow_execution_nodes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_execution_nodes" ADD CONSTRAINT "flow_execution_nodes_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "flow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_execution_logs" ADD CONSTRAINT "flow_execution_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_execution_logs" ADD CONSTRAINT "flow_execution_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "flow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
