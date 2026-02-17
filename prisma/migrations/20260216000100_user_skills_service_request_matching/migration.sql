-- AlterTable
ALTER TABLE "users"
ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "currentLatitude" DOUBLE PRECISION,
ADD COLUMN "currentLongitude" DOUBLE PRECISION,
ADD COLUMN "lastLocationUpdate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "service_requests"
ADD COLUMN "requestedSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "assignedTechnicianId" TEXT;

-- CreateIndex
CREATE INDEX "service_requests_assignedTechnicianId_idx" ON "service_requests"("assignedTechnicianId");

-- AddForeignKey
ALTER TABLE "service_requests"
ADD CONSTRAINT "service_requests_assignedTechnicianId_fkey"
FOREIGN KEY ("assignedTechnicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
