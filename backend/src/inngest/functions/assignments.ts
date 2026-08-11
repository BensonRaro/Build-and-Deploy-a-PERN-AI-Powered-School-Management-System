/**
 * Assignment Generation Inngest Function
 *
 * Uses Google Gemini (gemini-3.6-flash — the same model as the timetable
 * function) to generate a question draft for a grade.
 *
 * The controller triggers this function asynchronously:
 *   1. POST /api/assignments/generate creates a jobId, fires the
 *      "assignments/generate" event and returns the jobId immediately.
 *   2. This function validates the grade/year, builds the prompt, calls
 *      Gemini, and stores the resulting draft (or error) in the in-memory
 *      assignment generation job store.
 *   3. The client polls GET /api/assignments/generate/:jobId until the job
 *      reaches a terminal state, then reviews/edits the draft before saving.
 *
 * @module inngest/functions/assignments
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { prisma } from "../../lib/prisma.js";
import { inngest } from "../instance.js";
import { NonRetriableError } from "inngest";
import {
  assignmentGenerationStore,
  type GeneratedQuestion,
} from "../../lib/assignment-generation-store.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract a JSON array from an AI text response, tolerating markdown fences.
 * Mirrors the timetable function's parsing strategy.
 */
const extractJsonArray = (text: string): unknown[] => {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error("AI response did not contain a valid JSON array.");
  }
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) {
    throw new Error("AI response JSON was not an array.");
  }
  return parsed;
};

// ─── Inngest Function ───────────────────────────────────────────────────────

export const generateAssignmentQuestions = inngest.createFunction(
  {
    id: "generate-assignment-questions",
    triggers: [{ event: "assignments/generate" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const {
      jobId,
      gradeId,
      academicYearId,
      subjectId,
      topic,
      difficulty,
      questionCount,
      type,
    } = event.data as {
      jobId: string;
      gradeId: string;
      academicYearId: string;
      subjectId?: string;
      topic?: string;
      difficulty: "Easy" | "Medium" | "Hard";
      questionCount: number;
      type: "WITH_ANSWERS" | "QUESTIONS_ONLY";
    };

    try {
      // ── Step 1: Validate the grade & fetch its subjects ───────────────
      const grade = await step.run("validate-grade", async () => {
        const result = await prisma.grade.findUnique({
          where: { id: gradeId },
          select: {
            id: true,
            name: true,
            section: true,
            subjects: {
              where: { academicYearId },
              select: { id: true, name: true, code: true, description: true },
            },
          },
        });

        if (!result) {
          throw new NonRetriableError(`Grade with ID "${gradeId}" not found.`);
        }
        return result;
      });

      // ── Step 2: Validate the academic year ─────────────────────────────
      const academicYear = await step.run("validate-academic-year", async () => {
        const result = await prisma.academicYear.findUnique({
          where: { id: academicYearId },
          select: { id: true, name: true },
        });

        if (!result) {
          throw new NonRetriableError(
            `Academic year with ID "${academicYearId}" not found.`,
          );
        }
        return result;
      });

      // ── Step 3: Build the AI prompt & call Gemini ──────────────────────
      const questions = await step.run("call-gemini-ai", async () => {
        const subjectsForGrade =
          grade.subjects.length > 0
            ? grade.subjects
            : [{ id: "", name: "General Studies", code: "GEN", description: null }];

        const selectedSubject = subjectId
          ? grade.subjects.find((s) => s.id === subjectId)
          : undefined;

        const subjectScope = selectedSubject
          ? `Subject: ${selectedSubject.name} (${selectedSubject.code})${selectedSubject.description ? ` — ${selectedSubject.description}` : ""}`
          : `Subjects for ${grade.name} - ${grade.section}: ${subjectsForGrade.map((s) => s.name).join(", ")}. Pick the most relevant subject(s) or a general assignment.`;

        const includeAnswerKey =
          type === "WITH_ANSWERS"
            ? "Include a concise `answerKey` field for every question."
            : "Do NOT include answer keys — questions only.";

        const systemPrompt = `You are an expert school teacher creating ${difficulty.toLowerCase()} assignments.

Context:
- Grade: ${grade.name} - ${grade.section} (Academic Year: ${academicYear.name})
- ${subjectScope}
${topic ? `- Topic focus: ${topic}` : "- Choose a suitable topic appropriate for this grade level."}

Create exactly ${questionCount} questions appropriate for this grade level.

Rules:
1. Questions must be age-appropriate and clearly worded.
2. Use a mix of recall and reasoning questions.
3. ${includeAnswerKey}
4. Assign a reasonable points value to each question (1-10).
5. Return ONLY a valid JSON array, no markdown, no commentary.

Each item must match exactly:
{
  "id": "q1",
  "question": "...",
  "points": 5
}${type === "WITH_ANSWERS" ? `,
  "answerKey": "concise correct answer"` : ""}`;

        const aiResponse = await generateText({
          model: google("gemini-3.6-flash"),
          system: systemPrompt,
          prompt: `Generate a ${difficulty.toLowerCase()} assignment for grade ${grade.name} - ${grade.section}${selectedSubject ? ` in ${selectedSubject.name}` : ""}${topic ? ` on "${topic}"` : ""} with ${questionCount} questions. Return only valid JSON.`,
          temperature: 0.7,
        });

        const rawQuestions = extractJsonArray(aiResponse.text);

        // ── Normalize & validate the draft ──────────────────────────────
        const draft: GeneratedQuestion[] = rawQuestions
          .map((raw, index): GeneratedQuestion | null => {
            const q = raw as Record<string, unknown>;
            const question = typeof q.question === "string" ? q.question.trim() : "";
            const points = typeof q.points === "number" && q.points > 0 ? q.points : 5;
            if (!question) return null;
            const item: GeneratedQuestion = {
              id: `q${index + 1}`,
              question,
              points,
            };
            if (type === "WITH_ANSWERS" && typeof q.answerKey === "string") {
              item.answerKey = q.answerKey.trim();
            }
            return item;
          })
          .filter((q): q is GeneratedQuestion => q !== null);

        if (draft.length === 0) {
          throw new Error("The AI did not return valid questions.");
        }

        return draft;
      });

      // ── Step 4: Store the result so the client can collect it ─────────
      await step.run("store-result", async () => {
        assignmentGenerationStore.complete(jobId, questions);
        return questions.length;
      });

      return {
        message: `Generated ${questions.length} questions for ${grade.name} - ${grade.section}`,
        questionCount: questions.length,
      };
    } catch (error) {
      // Only a NonRetriableError is guaranteed to be final — Inngest will not
      // retry it, so the store can safely report "failed" to the client.
      // Transient failures are left "pending": Inngest retries the function,
      // and if the retry succeeds the store-result step overwrites the job
      // with "completed". If every retry fails (or the process dies), the
      // client's max-wait timeout (see useGenerationJob) gives up instead of
      // polling forever.
      if (error instanceof NonRetriableError) {
        assignmentGenerationStore.fail(jobId, error.message);
      }
      // Re-throw so Inngest tracks the run as failed and applies its retry
      // policy (retries: 2) for transient errors.
      throw error;
    }
  },
);
