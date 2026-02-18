BEGIN;

CREATE TYPE "UrgencyLevel_new" AS ENUM ('baja', 'media', 'alta');

ALTER TABLE "service_requests"
ALTER COLUMN "urgency" DROP DEFAULT;

ALTER TABLE "service_requests"
ALTER COLUMN "urgency" TYPE "UrgencyLevel_new"
USING (
  CASE
    WHEN "urgency"::text IN ('LOW', 'BAJA', 'baja') THEN 'baja'
    WHEN "urgency"::text IN ('MEDIUM', 'MEDIA', 'media') THEN 'media'
    WHEN "urgency"::text IN ('HIGH', 'EMERGENCY', 'ALTA', 'alta') THEN 'alta'
    ELSE 'media'
  END
)::"UrgencyLevel_new";

DROP TYPE "UrgencyLevel";
ALTER TYPE "UrgencyLevel_new" RENAME TO "UrgencyLevel";

ALTER TABLE "service_requests"
ALTER COLUMN "urgency" SET DEFAULT 'media';

COMMIT;
