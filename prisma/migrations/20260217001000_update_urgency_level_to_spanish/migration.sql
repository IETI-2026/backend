BEGIN;

CREATE TYPE "UrgencyLevel_new" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

ALTER TABLE "service_requests"
ALTER COLUMN "urgency" DROP DEFAULT;

ALTER TABLE "service_requests"
ALTER COLUMN "urgency" TYPE "UrgencyLevel_new"
USING (
  CASE
    WHEN "urgency"::text = 'LOW' THEN 'BAJA'
    WHEN "urgency"::text = 'MEDIUM' THEN 'MEDIA'
    WHEN "urgency"::text = 'HIGH' THEN 'ALTA'
    WHEN "urgency"::text = 'EMERGENCY' THEN 'ALTA'
    ELSE 'MEDIA'
  END
)::"UrgencyLevel_new";

DROP TYPE "UrgencyLevel";
ALTER TYPE "UrgencyLevel_new" RENAME TO "UrgencyLevel";

ALTER TABLE "service_requests"
ALTER COLUMN "urgency" SET DEFAULT 'MEDIA';

COMMIT;
