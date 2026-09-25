import prisma from "../lib/prisma";
import { AssessmentType } from "@prisma/client";

interface CreateSectionInput {
  title: string;
  sortOrder?: number;
  weightage?: number;
  questions: { label: string; maxScore: number; sortOrder?: number }[];
}

interface CreateAssessmentInput {
  batchId: string;
  title: string;
  type: AssessmentType;
  assessmentDate: string;
  maxScore?: number;
  sections?: CreateSectionInput[];
}

interface QuestionScoreInput {
  questionId: string;
  score: number;
}

class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export { ServiceError };

async function recalcMaxScore(assessmentId: string) {
  const sections = await prisma.assessmentSection.findMany({
    where: { assessmentId },
    include: { questions: true },
  });
  const totalMax = sections.reduce(
    (sum, s) => sum + s.questions.reduce((qs, q) => qs + q.maxScore, 0),
    0
  );
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { maxScore: totalMax },
  });
  return totalMax;
}

async function hasScoresForAssessment(assessmentId: string): Promise<boolean> {
  const count = await prisma.studentQuestionScore.count({
    where: {
      question: {
        section: { assessmentId },
      },
    },
  });
  return count > 0;
}

async function hasScoresForSection(sectionId: string): Promise<boolean> {
  const count = await prisma.studentQuestionScore.count({
    where: {
      question: { sectionId },
    },
  });
  return count > 0;
}

async function hasScoresForQuestion(questionId: string): Promise<boolean> {
  const count = await prisma.studentQuestionScore.count({
    where: { questionId },
  });
  return count > 0;
}

function calculateOverallScore(
  sections: {
    weightage: number | null;
    questions: { maxScore: number; studentScores: { score: number }[] }[];
  }[]
): number {
  const hasWeightage = sections.every((s) => s.weightage !== null && s.weightage !== undefined);

  if (hasWeightage) {
    let weightedTotal = 0;
    for (const section of sections) {
      const sectionMax = section.questions.reduce((sum, q) => sum + q.maxScore, 0);
      const sectionScore = section.questions.reduce(
        (sum, q) => sum + (q.studentScores[0]?.score ?? 0),
        0
      );
      if (sectionMax > 0) {
        weightedTotal += (sectionScore / sectionMax) * (section.weightage as number);
      }
    }
    return Math.round(weightedTotal * 100) / 100;
  }

  return sections.reduce(
    (sum, s) =>
      sum + s.questions.reduce((qs, q) => qs + (q.studentScores[0]?.score ?? 0), 0),
    0
  );
}

export async function createAssessment(input: CreateAssessmentInput) {
  const batch = await prisma.batch.findUnique({ where: { id: input.batchId } });
  if (!batch) {
    throw new ServiceError("Batch not found", 404);
  }

  let calculatedMaxScore = input.maxScore ?? 0;

  if (input.sections && input.sections.length > 0) {
    calculatedMaxScore = input.sections.reduce(
      (sum, s) => sum + s.questions.reduce((qs, q) => qs + q.maxScore, 0),
      0
    );
  }

  const assessment = await prisma.assessment.create({
    data: {
      batchId: input.batchId,
      title: input.title,
      type: input.type,
      maxScore: calculatedMaxScore,
      assessmentDate: new Date(input.assessmentDate),
      sections: input.sections
        ? {
            create: input.sections.map((s, si) => ({
              title: s.title,
              sortOrder: s.sortOrder ?? si,
              weightage: s.weightage,
              questions: {
                create: s.questions.map((q, qi) => ({
                  label: q.label,
                  maxScore: q.maxScore,
                  sortOrder: q.sortOrder ?? qi,
                })),
              },
            })),
          }
        : undefined,
    },
    include: {
      batch: { select: { id: true, name: true } },
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          questions: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  return assessment;
}

export async function listAssessments(filters: { batchId?: string; type?: AssessmentType }) {
  const where: Record<string, unknown> = {};
  if (filters.batchId) where.batchId = filters.batchId;
  if (filters.type) where.type = filters.type;

  const assessments = await prisma.assessment.findMany({
    where,
    include: {
      batch: { select: { id: true, name: true } },
      sections: {
        include: { questions: { select: { id: true } } },
      },
      results: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return assessments.map((a) => ({
    id: a.id,
    batchId: a.batchId,
    batchName: a.batch.name,
    title: a.title,
    type: a.type,
    maxScore: a.maxScore,
    assessmentDate: a.assessmentDate,
    createdAt: a.createdAt,
    sectionCount: a.sections.length,
    questionCount: a.sections.reduce((sum, s) => sum + s.questions.length, 0),
    resultCount: a.results.length,
  }));
}

export async function getAssessmentById(id: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      batch: { select: { id: true, name: true } },
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          questions: {
            orderBy: { sortOrder: "asc" },
            include: {
              studentScores: {
                include: { student: { select: { id: true, name: true, email: true } } },
              },
            },
          },
        },
      },
      results: {
        include: { student: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!assessment) {
    throw new ServiceError("Assessment not found", 404);
  }

  return assessment;
}

export async function updateAssessment(
  id: string,
  data: { title?: string; type?: AssessmentType; assessmentDate?: string }
) {
  const existing = await prisma.assessment.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("Assessment not found", 404);
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.assessmentDate !== undefined) updateData.assessmentDate = new Date(data.assessmentDate);

  const assessment = await prisma.assessment.update({
    where: { id },
    data: updateData,
    include: {
      batch: { select: { id: true, name: true } },
      sections: {
        orderBy: { sortOrder: "asc" },
        include: { questions: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  return assessment;
}

export async function deleteAssessment(id: string) {
  const existing = await prisma.assessment.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("Assessment not found", 404);
  }

  await prisma.assessmentResult.deleteMany({ where: { assessmentId: id } });
  await prisma.assessment.delete({ where: { id } });
}

export async function addSection(
  assessmentId: string,
  data: { title: string; sortOrder?: number; weightage?: number }
) {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) {
    throw new ServiceError("Assessment not found", 404);
  }

  if (await hasScoresForAssessment(assessmentId)) {
    throw new ServiceError(
      "Cannot modify structure: student scores already exist for this assessment",
      409
    );
  }

  const section = await prisma.assessmentSection.create({
    data: {
      assessmentId,
      title: data.title,
      sortOrder: data.sortOrder ?? 0,
      weightage: data.weightage,
    },
    include: { questions: true },
  });

  await recalcMaxScore(assessmentId);
  return section;
}

export async function updateSection(
  assessmentId: string,
  sectionId: string,
  data: { title?: string; sortOrder?: number; weightage?: number }
) {
  const section = await prisma.assessmentSection.findFirst({
    where: { id: sectionId, assessmentId },
  });
  if (!section) {
    throw new ServiceError("Section not found", 404);
  }

  if (await hasScoresForSection(sectionId)) {
    throw new ServiceError(
      "Cannot modify section: student scores already exist for questions in this section",
      409
    );
  }

  const updated = await prisma.assessmentSection.update({
    where: { id: sectionId },
    data,
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  return updated;
}

export async function deleteSection(assessmentId: string, sectionId: string) {
  const section = await prisma.assessmentSection.findFirst({
    where: { id: sectionId, assessmentId },
  });
  if (!section) {
    throw new ServiceError("Section not found", 404);
  }

  if (await hasScoresForSection(sectionId)) {
    throw new ServiceError(
      "Cannot delete section: student scores already exist for questions in this section",
      409
    );
  }

  await prisma.assessmentSection.delete({ where: { id: sectionId } });
  await recalcMaxScore(assessmentId);
}

export async function addQuestion(
  assessmentId: string,
  sectionId: string,
  data: { label: string; maxScore: number; sortOrder?: number }
) {
  const section = await prisma.assessmentSection.findFirst({
    where: { id: sectionId, assessmentId },
  });
  if (!section) {
    throw new ServiceError("Section not found in this assessment", 404);
  }

  if (await hasScoresForAssessment(assessmentId)) {
    throw new ServiceError(
      "Cannot modify structure: student scores already exist for this assessment",
      409
    );
  }

  const question = await prisma.assessmentQuestion.create({
    data: {
      sectionId,
      label: data.label,
      maxScore: data.maxScore,
      sortOrder: data.sortOrder ?? 0,
    },
  });

  await recalcMaxScore(assessmentId);
  return question;
}

export async function updateQuestion(
  assessmentId: string,
  questionId: string,
  data: { label?: string; maxScore?: number; sortOrder?: number }
) {
  const question = await prisma.assessmentQuestion.findFirst({
    where: {
      id: questionId,
      section: { assessmentId },
    },
  });
  if (!question) {
    throw new ServiceError("Question not found in this assessment", 404);
  }

  if (await hasScoresForQuestion(questionId)) {
    throw new ServiceError(
      "Cannot modify question: student scores already exist for this question",
      409
    );
  }

  const updated = await prisma.assessmentQuestion.update({
    where: { id: questionId },
    data,
  });

  if (data.maxScore !== undefined) {
    await recalcMaxScore(assessmentId);
  }

  return updated;
}

export async function deleteQuestion(assessmentId: string, questionId: string) {
  const question = await prisma.assessmentQuestion.findFirst({
    where: {
      id: questionId,
      section: { assessmentId },
    },
  });
  if (!question) {
    throw new ServiceError("Question not found in this assessment", 404);
  }

  if (await hasScoresForQuestion(questionId)) {
    throw new ServiceError(
      "Cannot delete question: student scores already exist for this question",
      409
    );
  }

  await prisma.assessmentQuestion.delete({ where: { id: questionId } });
  await recalcMaxScore(assessmentId);
}

export async function submitQuestionScores(
  assessmentId: string,
  input: { studentId: string; questionScores: QuestionScoreInput[]; remarks?: string }
) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      sections: {
        include: { questions: true },
      },
    },
  });
  if (!assessment) {
    throw new ServiceError("Assessment not found", 404);
  }

  const batchMember = await prisma.batchMember.findUnique({
    where: {
      batchId_studentId: {
        batchId: assessment.batchId,
        studentId: input.studentId,
      },
    },
  });
  if (!batchMember) {
    throw new ServiceError("Student does not belong to the assessment's batch", 400);
  }

  const questionMap = new Map<string, { maxScore: number; sectionId: string }>();
  for (const section of assessment.sections) {
    for (const q of section.questions) {
      questionMap.set(q.id, { maxScore: q.maxScore, sectionId: section.id });
    }
  }

  for (const qs of input.questionScores) {
    const question = questionMap.get(qs.questionId);
    if (!question) {
      throw new ServiceError(
        `Question ${qs.questionId} does not belong to this assessment`,
        400
      );
    }
    if (qs.score < 0) {
      throw new ServiceError(`Score for question ${qs.questionId} cannot be negative`, 400);
    }
    if (qs.score > question.maxScore) {
      throw new ServiceError(
        `Score ${qs.score} exceeds maxScore ${question.maxScore} for question ${qs.questionId}`,
        400
      );
    }
  }

  const upsertedScores = [];
  for (const qs of input.questionScores) {
    const result = await prisma.studentQuestionScore.upsert({
      where: {
        questionId_studentId: {
          questionId: qs.questionId,
          studentId: input.studentId,
        },
      },
      update: { score: qs.score },
      create: {
        questionId: qs.questionId,
        studentId: input.studentId,
        score: qs.score,
      },
    });
    upsertedScores.push(result);
  }

  const sectionsWithScores = await prisma.assessmentSection.findMany({
    where: { assessmentId },
    include: {
      questions: {
        include: {
          studentScores: {
            where: { studentId: input.studentId },
          },
        },
      },
    },
  });

  const overallScore = calculateOverallScore(sectionsWithScores);

  const assessmentResult = await prisma.assessmentResult.upsert({
    where: {
      assessmentId_studentId: {
        assessmentId,
        studentId: input.studentId,
      },
    },
    update: { score: overallScore, remarks: input.remarks },
    create: {
      assessmentId,
      studentId: input.studentId,
      score: overallScore,
      remarks: input.remarks,
    },
  });

  return { questionScores: upsertedScores, result: assessmentResult };
}

export async function getResults(assessmentId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      batch: { select: { id: true, name: true } },
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          questions: {
            orderBy: { sortOrder: "asc" },
            include: {
              studentScores: {
                include: { student: { select: { id: true, name: true, email: true } } },
              },
            },
          },
        },
      },
      results: {
        include: { student: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!assessment) {
    throw new ServiceError("Assessment not found", 404);
  }

  const hasWeightage = assessment.sections.every(
    (s) => s.weightage !== null && s.weightage !== undefined
  );

  const studentResults = assessment.results.map((r) => {
    const sectionBreakdown = assessment.sections.map((section) => {
      const sectionMax = section.questions.reduce((sum, q) => sum + q.maxScore, 0);
      const studentSectionScore = section.questions.reduce((sum, q) => {
        const studentScore = q.studentScores.find((ss) => ss.studentId === r.studentId);
        return sum + (studentScore?.score ?? 0);
      }, 0);

      const result: Record<string, unknown> = {
        sectionId: section.id,
        sectionTitle: section.title,
        sectionMax,
        sectionScore: studentSectionScore,
      };

      if (hasWeightage && section.weightage !== null) {
        result.weightage = section.weightage;
        result.weightedScore =
          sectionMax > 0
            ? Math.round(((studentSectionScore / sectionMax) * section.weightage) * 100) / 100
            : 0;
      }

      return result;
    });

    return {
      studentId: r.studentId,
      studentName: r.student.name,
      studentEmail: r.student.email,
      overallScore: r.score,
      remarks: r.remarks,
      sections: sectionBreakdown,
    };
  });

  return {
    assessment: {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      maxScore: assessment.maxScore,
      batchName: assessment.batch.name,
      assessmentDate: assessment.assessmentDate,
      hasWeightage,
    },
    results: studentResults,
  };
}

export async function getStudentResult(assessmentId: string, studentId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      batch: { select: { id: true, name: true } },
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          questions: {
            orderBy: { sortOrder: "asc" },
            include: {
              studentScores: {
                where: { studentId },
              },
            },
          },
        },
      },
      results: {
        where: { studentId },
        include: { student: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!assessment) {
    throw new ServiceError("Assessment not found", 404);
  }

  const result = assessment.results[0];
  if (!result) {
    throw new ServiceError("No result found for this student", 404);
  }

  const hasWeightage = assessment.sections.every(
    (s) => s.weightage !== null && s.weightage !== undefined
  );

  const sections = assessment.sections.map((section) => {
    const sectionMax = section.questions.reduce((sum, q) => sum + q.maxScore, 0);
    const sectionScore = section.questions.reduce(
      (sum, q) => sum + (q.studentScores[0]?.score ?? 0),
      0
    );

    const sectionData: Record<string, unknown> = {
      sectionId: section.id,
      sectionTitle: section.title,
      sectionMax,
      sectionScore,
      questions: section.questions.map((q) => ({
        questionId: q.id,
        label: q.label,
        maxScore: q.maxScore,
        score: q.studentScores[0]?.score ?? null,
      })),
    };

    if (hasWeightage && section.weightage !== null) {
      sectionData.weightage = section.weightage;
      sectionData.weightedScore =
        sectionMax > 0
          ? Math.round(((sectionScore / sectionMax) * section.weightage) * 100) / 100
          : 0;
    }

    return sectionData;
  });

  return {
    studentId: result.studentId,
    studentName: result.student.name,
    studentEmail: result.student.email,
    assessmentTitle: assessment.title,
    assessmentType: assessment.type,
    maxScore: assessment.maxScore,
    overallScore: result.score,
    remarks: result.remarks,
    hasWeightage,
    sections,
  };
}

interface BulkRow {
  studentId: string;
  questionId: string;
  score: string;
}

export async function bulkUploadScores(assessmentId: string, rows: BulkRow[]) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      sections: {
        include: { questions: true },
      },
    },
  });
  if (!assessment) {
    throw new ServiceError("Assessment not found", 404);
  }

  const batchMembers = await prisma.batchMember.findMany({
    where: { batchId: assessment.batchId },
  });
  const batchStudentIds = new Set(batchMembers.map((bm) => bm.studentId));

  const questionMap = new Map<string, { maxScore: number }>();
  for (const section of assessment.sections) {
    for (const q of section.questions) {
      questionMap.set(q.id, { maxScore: q.maxScore });
    }
  }

  const results: {
    row: number;
    status: "created" | "updated" | "error";
    studentId?: string;
    questionId?: string;
    error?: string;
  }[] = [];
  const affectedStudents = new Set<string>();
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-based, skip header

    if (!row.studentId || !row.questionId || row.score === undefined || row.score === "") {
      results.push({ row: rowNum, status: "error", error: "Missing required fields" });
      errors++;
      continue;
    }

    const scoreNum = parseFloat(row.score);
    if (isNaN(scoreNum)) {
      results.push({
        row: rowNum,
        status: "error",
        studentId: row.studentId,
        questionId: row.questionId,
        error: "Score is not a valid number",
      });
      errors++;
      continue;
    }

    if (!batchStudentIds.has(row.studentId)) {
      results.push({
        row: rowNum,
        status: "error",
        studentId: row.studentId,
        questionId: row.questionId,
        error: "Student does not belong to the assessment's batch",
      });
      errors++;
      continue;
    }

    const question = questionMap.get(row.questionId);
    if (!question) {
      results.push({
        row: rowNum,
        status: "error",
        studentId: row.studentId,
        questionId: row.questionId,
        error: "Question does not belong to this assessment",
      });
      errors++;
      continue;
    }

    if (scoreNum < 0 || scoreNum > question.maxScore) {
      results.push({
        row: rowNum,
        status: "error",
        studentId: row.studentId,
        questionId: row.questionId,
        error: `Score must be between 0 and ${question.maxScore}`,
      });
      errors++;
      continue;
    }

    try {
      const existing = await prisma.studentQuestionScore.findUnique({
        where: {
          questionId_studentId: {
            questionId: row.questionId,
            studentId: row.studentId,
          },
        },
      });

      await prisma.studentQuestionScore.upsert({
        where: {
          questionId_studentId: {
            questionId: row.questionId,
            studentId: row.studentId,
          },
        },
        update: { score: scoreNum },
        create: {
          questionId: row.questionId,
          studentId: row.studentId,
          score: scoreNum,
        },
      });

      affectedStudents.add(row.studentId);

      if (existing) {
        results.push({
          row: rowNum,
          status: "updated",
          studentId: row.studentId,
          questionId: row.questionId,
        });
        updated++;
      } else {
        results.push({
          row: rowNum,
          status: "created",
          studentId: row.studentId,
          questionId: row.questionId,
        });
        created++;
      }
    } catch {
      results.push({
        row: rowNum,
        status: "error",
        studentId: row.studentId,
        questionId: row.questionId,
        error: "Database error while upserting score",
      });
      errors++;
    }
  }

  for (const studentId of affectedStudents) {
    const sectionsWithScores = await prisma.assessmentSection.findMany({
      where: { assessmentId },
      include: {
        questions: {
          include: {
            studentScores: {
              where: { studentId },
            },
          },
        },
      },
    });

    const overallScore = calculateOverallScore(sectionsWithScores);

    await prisma.assessmentResult.upsert({
      where: {
        assessmentId_studentId: {
          assessmentId,
          studentId,
        },
      },
      update: { score: overallScore },
      create: {
        assessmentId,
        studentId,
        score: overallScore,
      },
    });
  }

  return {
    total: rows.length,
    created,
    updated,
    errors,
    details: results,
  };
}
