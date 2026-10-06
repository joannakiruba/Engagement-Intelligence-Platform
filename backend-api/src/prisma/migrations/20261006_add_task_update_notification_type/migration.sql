-- Add TASK_UPDATE to the NotificationType enum
-- This value is required by the intervention overdue notification worker.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_UPDATE';
