import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createAssessment,
  getAssessment,
  updateAssessment,
  SectionInput,
} from "../../services/assessments.service";

interface QuestionForm {
  label: string;
  maxScore: number;
}

interface SectionForm {
  title: string;
  weightage: string;
  questions: QuestionForm[];
}

export default function AssessmentCreate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState("");
  const [type, setType] = useState("CODING_TEST");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [sections, setSections] = useState<SectionForm[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasScores, setHasScores] = useState(false);

  useEffect(() => {
    if (isEdit) {
      getAssessment(id).then((res) => {
        const a = res.data;
        setTitle(a.title);
        setBatchId(a.batchId);
        setType(a.type);
        setAssessmentDate(a.assessmentDate?.split("T")[0] || "");
        if (a.sections) {
          setSections(
            a.sections.map((s: any) => ({
              title: s.title,
              weightage: s.weightage?.toString() || "",
              questions: s.questions.map((q: any) => ({
                label: q.label,
                maxScore: q.maxScore,
              })),
            }))
          );
          const totalScores = a.sections.reduce(
            (sum: number, s: any) =>
              sum +
              s.questions.reduce(
                (qs: number, q: any) => qs + (q.studentScores?.length || 0),
                0
              ),
            0
          );
          setHasScores(totalScores > 0);
        }
      });
    }
  }, [id]);

  const totalMaxScore = sections.reduce(
    (sum, s) => sum + s.questions.reduce((qs, q) => qs + (q.maxScore || 0), 0),
    0
  );

  const weightageTotal = sections.reduce(
    (sum, s) => sum + (parseFloat(s.weightage) || 0),
    0
  );

  const hasWeightage = sections.some((s) => s.weightage !== "");

  const addSection = () => {
    setSections([...sections, { title: "", weightage: "", questions: [{ label: "", maxScore: 0 }] }]);
  };

  const removeSection = (si: number) => {
    setSections(sections.filter((_, i) => i !== si));
  };

  const updateSectionField = (si: number, field: string, value: string) => {
    const updated = [...sections];
    (updated[si] as any)[field] = value;
    setSections(updated);
  };

  const addQuestion = (si: number) => {
    const updated = [...sections];
    updated[si].questions.push({ label: "", maxScore: 0 });
    setSections(updated);
  };

  const removeQuestion = (si: number, qi: number) => {
    const updated = [...sections];
    updated[si].questions = updated[si].questions.filter((_, i) => i !== qi);
    setSections(updated);
  };

  const updateQuestionField = (si: number, qi: number, field: string, value: string | number) => {
    const updated = [...sections];
    (updated[si].questions[qi] as any)[field] = value;
    setSections(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const sectionPayload: SectionInput[] | undefined =
        sections.length > 0
          ? sections.map((s, si) => ({
              title: s.title,
              sortOrder: si,
              weightage: s.weightage ? parseFloat(s.weightage) : undefined,
              questions: s.questions.map((q, qi) => ({
                label: q.label,
                maxScore: q.maxScore,
                sortOrder: qi,
              })),
            }))
          : undefined;

      if (isEdit) {
        await updateAssessment(id, {
          title,
          type,
          assessmentDate: new Date(assessmentDate).toISOString(),
        });
      } else {
        await createAssessment({
          batchId,
          title,
          type,
          assessmentDate: new Date(assessmentDate).toISOString(),
          sections: sectionPayload,
        });
      }
      navigate("/assessments");
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.details?.[0]?.message || "An error occurred";
      setError(msg);
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? "Edit" : "Create"} Assessment</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch ID</label>
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
              disabled={isEdit}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="CODING_TEST">Coding Test</option>
              <option value="QUIZ">Quiz</option>
              <option value="ASSIGNMENT">Assignment</option>
              <option value="CONTEST">Contest</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
        </div>

        {!isEdit && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Sections & Questions</h2>
                {sections.length > 0 && (
                  <p className="text-sm text-gray-500">
                    Total Max Score: {totalMaxScore}
                    {hasWeightage && (
                      <span
                        className={
                          Math.abs(weightageTotal - 100) < 0.01
                            ? " text-green-600"
                            : " text-red-600"
                        }
                      >
                        {" | "}Weightage Total: {weightageTotal}%
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={addSection}
                className="bg-gray-100 border px-3 py-1 rounded text-sm hover:bg-gray-200"
                disabled={hasScores}
              >
                + Add Section
              </button>
            </div>

            {hasScores && (
              <p className="text-amber-600 text-sm">
                Structure cannot be modified because student scores already exist.
              </p>
            )}

            {sections.map((section, si) => (
              <div key={si} className="border rounded-lg p-4 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Section title"
                    value={section.title}
                    onChange={(e) => updateSectionField(si, "title", e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Weightage %"
                    value={section.weightage}
                    onChange={(e) => updateSectionField(si, "weightage", e.target.value)}
                    className="w-32 border rounded px-3 py-2"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                  <button
                    type="button"
                    onClick={() => removeSection(si)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>

                {section.questions.map((q, qi) => (
                  <div key={qi} className="flex items-center gap-2 ml-4 mb-2">
                    <input
                      type="text"
                      placeholder="Question label"
                      value={q.label}
                      onChange={(e) => updateQuestionField(si, qi, "label", e.target.value)}
                      className="flex-1 border rounded px-3 py-1.5 text-sm"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={q.maxScore || ""}
                      onChange={(e) =>
                        updateQuestionField(si, qi, "maxScore", parseFloat(e.target.value) || 0)
                      }
                      className="w-24 border rounded px-3 py-1.5 text-sm"
                      step="0.01"
                      min="0.01"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeQuestion(si, qi)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      X
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addQuestion(si)}
                  className="ml-4 text-blue-600 text-sm hover:underline"
                >
                  + Add Question
                </button>
              </div>
            ))}
          </>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : isEdit ? "Update" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/assessments")}
            className="border px-6 py-2 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
