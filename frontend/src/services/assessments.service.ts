import axios from "axios";

const API = "/api/assessments";

export interface SectionInput {
  title: string;
  sortOrder?: number;
  weightage?: number;
  questions: { label: string; maxScore: number; sortOrder?: number }[];
}

export interface CreateAssessmentPayload {
  batchId: string;
  title: string;
  type: string;
  assessmentDate: string;
  maxScore?: number;
  sections?: SectionInput[];
}

export interface QuestionScore {
  questionId: string;
  score: number;
}

export async function getAssessments(params?: { batchId?: string; type?: string }) {
  const res = await axios.get(API, { params });
  return res.data;
}

export async function getAssessment(id: string) {
  const res = await axios.get(`${API}/${id}`);
  return res.data;
}

export async function createAssessment(payload: CreateAssessmentPayload) {
  const res = await axios.post(API, payload);
  return res.data;
}

export async function updateAssessment(id: string, payload: Partial<CreateAssessmentPayload>) {
  const res = await axios.put(`${API}/${id}`, payload);
  return res.data;
}

export async function deleteAssessment(id: string) {
  const res = await axios.delete(`${API}/${id}`);
  return res.data;
}

export async function submitQuestionScores(
  assessmentId: string,
  data: { studentId: string; questionScores: QuestionScore[]; remarks?: string }
) {
  const res = await axios.post(`${API}/${assessmentId}/scores`, data);
  return res.data;
}

export async function getResults(assessmentId: string) {
  const res = await axios.get(`${API}/${assessmentId}/results`);
  return res.data;
}

export async function getStudentResult(assessmentId: string, studentId: string) {
  const res = await axios.get(`${API}/${assessmentId}/results/${studentId}`);
  return res.data;
}

export async function bulkUploadScores(assessmentId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await axios.post(`${API}/${assessmentId}/scores/bulk`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
