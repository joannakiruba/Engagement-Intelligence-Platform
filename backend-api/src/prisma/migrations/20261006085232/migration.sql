DO $$
BEGIN
    CREATE TYPE "FlagReason" AS ENUM ('IP_MISMATCH', 'DEVICE_CONFLICT', 'DEVICE_RESET', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "FlagStatus" AS ENUM ('PENDING', 'CONFIRMED_FRAUD', 'DISMISSED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "assessments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- RenameIndex
ALTER INDEX "taskId_studentId" RENAME TO "task_submissions_taskId_studentId_key";
