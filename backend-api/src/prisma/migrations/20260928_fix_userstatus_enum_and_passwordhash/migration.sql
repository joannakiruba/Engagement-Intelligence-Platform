-- Fix schema-migration drift: add PENDING to UserStatus enum
-- and make passwordHash nullable to match Prisma schema

ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'ACTIVE';

ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;
