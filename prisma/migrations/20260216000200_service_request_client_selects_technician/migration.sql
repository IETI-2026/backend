-- CreateEnum
CREATE TYPE "TechnicianResponseStatus" AS ENUM ('ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "service_requests"
ADD COLUMN "serviceCity" TEXT NOT NULL DEFAULT 'unknown';

-- CreateTable
CREATE TABLE "service_request_technician_responses" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "technicianUserId" TEXT NOT NULL,
  "status" "TechnicianResponseStatus" NOT NULL,
  "reason" TEXT,
  "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_request_technician_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_request_technician_responses_serviceRequestId_technician_idx"
ON "service_request_technician_responses"("serviceRequestId", "technicianUserId");

-- CreateIndex
CREATE INDEX "service_request_technician_responses_serviceRequestId_status_idx"
ON "service_request_technician_responses"("serviceRequestId", "status");

-- CreateIndex
CREATE INDEX "service_request_technician_responses_technicianUserId_status_idx"
ON "service_request_technician_responses"("technicianUserId", "status");

-- AddForeignKey
ALTER TABLE "service_request_technician_responses"
ADD CONSTRAINT "service_request_technician_responses_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_technician_responses"
ADD CONSTRAINT "service_request_technician_responses_technicianUserId_fkey"
FOREIGN KEY ("technicianUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
