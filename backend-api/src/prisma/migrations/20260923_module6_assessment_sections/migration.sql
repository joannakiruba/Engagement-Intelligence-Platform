-- Module 6: Assessment & Performance Capture
-- Adds assessment sections, questions, and student question scores

-- Add updatedAt to assessments table
ALTER TABLE "assessments" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable: assessment_sections
CREATE TABLE "assessment_sections" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "weightage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: assessment_questions
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: student_question_scores
CREATE TABLE "student_question_scores" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_question_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on student_question_scores
CREATE UNIQUE INDEX "student_question_scores_questionId_studentId_key" ON "student_question_scores"("questionId", "studentId");

-- AddForeignKey: assessment_sections -> assessments (CASCADE)
ALTER TABLE "assessment_sections" ADD CONSTRAINT "assessment_sections_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: assessment_questions -> assessment_sections (CASCADE)
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "assessment_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: student_question_scores -> assessment_questions (CASCADE)
ALTER TABLE "student_question_scores" ADD CONSTRAINT "student_question_scores_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: student_question_scores -> users (RESTRICT)
ALTER TABLE "student_question_scores" ADD CONSTRAINT "student_question_scores_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
