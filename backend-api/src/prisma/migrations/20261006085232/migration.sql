-- CreateEnum
CREATE TYPE "FlagReason" AS ENUM ('IP_MISMATCH', 'DEVICE_CONFLICT', 'DEVICE_RESET', 'MANUAL');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('PENDING', 'CONFIRMED_FRAUD', 'DISMISSED');

-- AlterTable
ALTER TABLE "assessments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "deviceTokenId" TEXT,
ADD COLUMN     "networkFingerprint" TEXT,
ADD COLUMN     "studentIp" TEXT;

-- AlterTable
ALTER TABLE "attendance_windows" ADD COLUMN     "networkFingerprint" TEXT,
ADD COLUMN     "trainerIp" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_flags" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" "FlagReason" NOT NULL,
    "details" TEXT,
    "status" "FlagStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_tokenHash_key" ON "device_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "device_tokens_studentId_idx" ON "device_tokens"("studentId");

-- CreateIndex
CREATE INDEX "attendance_flags_studentId_idx" ON "attendance_flags"("studentId");

-- CreateIndex
CREATE INDEX "attendance_flags_status_idx" ON "attendance_flags"("status");

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "taskId_studentId" RENAME TO "task_submissions_taskId_studentId_key";
