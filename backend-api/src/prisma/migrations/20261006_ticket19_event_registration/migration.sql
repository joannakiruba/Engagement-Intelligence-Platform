-- Ticket 19: Event Registration Module
-- Migrates Event and EventRegistration models, adds EventBatch and EventRound tables.

-- New enums
CREATE TYPE "EventCategory" AS ENUM ('CODING', 'HACKATHON', 'OTHER');
CREATE TYPE "EventMode" AS ENUM ('ONLINE', 'OFFLINE');
CREATE TYPE "EventRoundStatus" AS ENUM ('UPCOMING', 'ONGOING', 'DONE');
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'INTERESTED', 'REGISTERED', 'WITHDRAWN');

-- Extend NotificationType
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_UPDATE';

-- ── events table ──

-- Drop old columns
ALTER TABLE "events" DROP COLUMN IF EXISTS "eventType";
ALTER TABLE "events" DROP COLUMN IF EXISTS "eventDate";
ALTER TABLE "events" DROP COLUMN IF EXISTS "registrationDeadline";

-- Add new columns
ALTER TABLE "events" ADD COLUMN "category" "EventCategory" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "events" ADD COLUMN "isMandatory" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "officialLink" TEXT;
ALTER TABLE "events" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "mode" "EventMode";
ALTER TABLE "events" ADD COLUMN "venue" TEXT;
ALTER TABLE "events" ADD COLUMN "fee" DOUBLE PRECISION;
ALTER TABLE "events" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- createdById: set a default from existing users so NOT NULL is satisfied for any existing rows
ALTER TABLE "events" ADD COLUMN "createdById" TEXT;

UPDATE "events"
SET "createdById" = (
    SELECT "id"
    FROM "users"
    LIMIT 1
);

ALTER TABLE "events"
ALTER COLUMN "createdById" SET NOT NULL;

-- FK for createdById
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── event_registrations table ──

-- Existing rows are real registrations — mark them REGISTERED before adding the default-PENDING column
ALTER TABLE "event_registrations" ADD COLUMN "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED';
-- Now flip default to PENDING for future inserts
ALTER TABLE "event_registrations" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "event_registrations" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "event_registrations" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop old column
ALTER TABLE "event_registrations" DROP COLUMN IF EXISTS "registeredAt";

-- Update FK to cascade on event delete
ALTER TABLE "event_registrations" DROP CONSTRAINT IF EXISTS "event_registrations_eventId_fkey";
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── event_batches table ──

CREATE TABLE "event_batches" (
    "eventId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "event_batches_pkey" PRIMARY KEY ("eventId","batchId")
);

ALTER TABLE "event_batches" ADD CONSTRAINT "event_batches_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_batches" ADD CONSTRAINT "event_batches_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── event_rounds table ──

CREATE TABLE "event_rounds" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roundDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "status" "EventRoundStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_rounds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_rounds_eventId_idx" ON "event_rounds"("eventId");

ALTER TABLE "event_rounds" ADD CONSTRAINT "event_rounds_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
