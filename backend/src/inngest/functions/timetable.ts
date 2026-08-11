/**
 * Timetable Generation Inngest Function
 *
 * Uses Google Gemini AI via the Vercel AI SDK to generate an optimized
 * weekly timetable for a specific grade.
 *
 * The AI receives:
 *   - All subjects defined for the target grade
 *   - All teachers (User.role = TEACHER) with their department & qualification
 *   - All existing timetable slots for OTHER grades (to avoid teacher/room collisions)
 *   - School operating hours & period configuration
 *
 * The AI intelligently matches teachers to subjects based on their
 * department/qualification fields. TeachergradeSubject records are
 * created automatically on-the-fly when slots are saved.
 *
 * @module inngest/functions/timetable
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { prisma } from "../../lib/prisma.js";
import { inngest } from "../instance.js";
import { NonRetriableError } from "inngest";

// ─── Constants ────────────────────────────────────────────────────────────────

/** School start time in minutes since midnight (8:00 AM = 480) */
const SCHOOL_START = 480;

/** School end time in minutes since midnight (3:00 PM = 900) */
const SCHOOL_END = 900;

/** Duration of a single period in minutes */
const PERIOD_DURATION = 40;

/** Days of the week the school operates (1 = Monday ... 5 = Friday) */
const ACTIVE_DAYS = [1, 2, 3, 4, 5];

const DAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
};

/** Max periods per day based on operating hours */
const MAX_PERIODS_PER_DAY = Math.floor(
  (SCHOOL_END - SCHOOL_START) / PERIOD_DURATION,
);

// ─── Helper: Format minutes since midnight to HH:MM ─────────────────────────

const fmtTime = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

// ─── Inngest Function ────────────────────────────────────────────────────────

export const generateTimetable = inngest.createFunction(
  {
    id: "generate-grade-timetable",
    triggers: [{ event: "timetable/generate" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { gradeId, academicYearId } = event.data as {
      gradeId: string;
      academicYearId: string;
    };

    // ── Step 1: Validate grade & academic year ─────────────────────────
    const gradeInfo = await step.run("validate-grade", async () => {
      const grade = await prisma.grade.findUnique({
        where: { id: gradeId },
        include: {
          academicYear: { select: { id: true, name: true } },
        },
      });

      if (!grade) {
        throw new NonRetriableError(`Grade with ID "${gradeId}" not found.`);
      }

      return grade;
    });

    // ── Step 2: Fetch subjects defined for this grade ──────────────────
    const subjects = await step.run("fetch-subjects", async () => {
      const subjectList = await prisma.subject.findMany({
        where: {
          gradeId,
          academicYearId,
        },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
        },
      });

      if (subjectList.length === 0) {
        throw new NonRetriableError(
          `No subjects found for this grade. Please create subjects for "${gradeInfo.name} - ${gradeInfo.section}" first.`,
        );
      }

      return subjectList;
    });

    // ── Step 3: Fetch all teachers with their department/qualification ─
    const teachers = await step.run("fetch-teachers", async () => {
      const teacherUsers = await prisma.user.findMany({
        where: {
          role: "TEACHER",
          deletedAt: null,
          active: true,
          staffProfile: { isNot: null },
        },
        select: {
          id: true,
          name: true,
          staffProfile: {
            select: {
              id: true,
              department: true,
              qualification: true,
            },
          },
        },
      });

      if (teacherUsers.length === 0) {
        throw new NonRetriableError(
          "No teachers found in the system. Please add teachers with their department and qualification details.",
        );
      }

      return teacherUsers;
    });

    // ── Step 4: Fetch existing timetables for OTHER grades ─────────────
    const existingSlots = await step.run("fetch-existing-slots", async () => {
      const slots = await prisma.timetableSlot.findMany({
        where: {
          gradeId: { not: gradeId },
        },
        select: {
          teacherId: true,
          gradeId: true,
          room: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          subjectName: true,
          teacherName: true,
        },
      });

      return slots;
    });

    // ── Step 5: Calculate subject weekly frequency requirements ────────
    const totalSlots = MAX_PERIODS_PER_DAY * ACTIVE_DAYS.length;
    const subjectsCount = subjects.length;
    const baseSessionsPerSubject = Math.floor(totalSlots / subjectsCount);
    const remainder = totalSlots % subjectsCount;
    const weeklySessionCounts: Record<string, number> = {};

    subjects.forEach((subj, idx) => {
      weeklySessionCounts[subj.id] =
        baseSessionsPerSubject + (idx < remainder ? 1 : 0);
    });

    // ── Step 6: Build the AI prompt ────────────────────────────────────
    const subjectsData = subjects.map((subj) => ({
      subjectId: subj.id,
      subjectName: subj.name,
      subjectCode: subj.code,
      description: subj.description ?? "",
      weeklySessions: weeklySessionCounts[subj.id],
    }));

    const teachersData = teachers.map((t) => ({
      userId: t.id,
      name: t.name,
      department: t.staffProfile?.department ?? "",
      qualification: t.staffProfile?.qualification ?? "",
    }));

    const existingData = existingSlots.map((s) => ({
      day: DAY_LABELS[s.dayOfWeek] ?? `Day ${s.dayOfWeek}`,
      startTime: fmtTime(s.startTime),
      endTime: fmtTime(s.endTime),
      teacherName: s.teacherName,
      subjectName: s.subjectName,
      room: s.room,
    }));

    const systemPrompt = `You are a school timetable scheduling expert. Generate an optimized weekly timetable.

School Configuration:
- Operating hours: ${fmtTime(SCHOOL_START)} — ${fmtTime(SCHOOL_END)}
- Period duration: ${PERIOD_DURATION} minutes
- Active days: Monday — Friday
- Max periods per day: ${MAX_PERIODS_PER_DAY}
- Total available slots: ${totalSlots}

Rules:
1. Each subject must be scheduled exactly the specified number of weekly sessions.
2. Match teachers to subjects based on their DEPARTMENT and QUALIFICATION. For example, a teacher with department "Mathematics" should teach Math subjects; a teacher with qualification "Physics" should teach Physics/Science subjects. Use your best judgment for the best match.
3. A teacher cannot be in two places at the same time slot across ALL grades.
4. A room cannot have two classes at the same time.
5. Spread subjects evenly across the week — no subject should appear twice in a row on the same day.
6. Include a ${PERIOD_DURATION}-minute break/lunch slot (marked as "Break" with teacherName "—") somewhere in the middle of each day.
7. The first period should start at ${fmtTime(SCHOOL_START)}.
8. Return a valid JSON array of slots.

IMPORTANT: Assign teachers to subjects based on their department and qualification fields. Use your reasoning to determine the best teacher for each subject.

EXISTING TIMETABLES (other grades — AVOID these teacher/slot conflicts):
${JSON.stringify(existingData, null, 2)}

SUBJECTS TO SCHEDULE FOR THIS GRADE:
${JSON.stringify(subjectsData, null, 2)}

AVAILABLE TEACHERS (match by department/qualification):
${JSON.stringify(teachersData, null, 2)}

Respond with ONLY a valid JSON array. Each slot object must have:
{
  "dayOfWeek": number (1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday),
  "startTime": number (minutes since midnight),
  "endTime": number (minutes since midnight),
  "subjectId": string (subject ID, or "BREAK" for break slots),
  "teacherUserId": string (teacher's userId, or "" for break slots — must be from the AVAILABLE TEACHERS list above),
  "teacherName": string,
  "subjectName": string (or "Break"),
  "room": string (room number, or "" for break slots)
}`;

    // ── Step 7: Call Gemini AI ─────────────────────────────────────────
    const aiResult = await step.run("call-gemini-ai", async () => {
      const response = await generateText({
        model: google("gemini-3.6-flash"),
        system: systemPrompt,
        prompt: `Generate a weekly timetable for grade "${gradeInfo.name} - ${gradeInfo.section}" (Academic Year: ${gradeInfo.academicYear.name}).

Subjects: ${subjects.map((s) => `${s.name} (${s.code}), ${weeklySessionCounts[s.id]}x/week`).join("; ")}

Teachers available: ${teachers.map((t) => `${t.name} (Dept: ${t.staffProfile?.department ?? "N/A"}, Qual: ${t.staffProfile?.qualification ?? "N/A"})`).join("; ")}

Use the teachers' departments and qualifications to match them to the right subjects. Return only valid JSON.`,
        temperature: 0.3,
      });

      const text = response.text;

      // Extract JSON from the response (handle potential markdown wrapping)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error(
          "AI response did not contain valid JSON array. Response: " +
            text.slice(0, 500),
        );
      }

      return JSON.parse(jsonMatch[0]) as Array<{
        dayOfWeek: number;
        startTime: number;
        endTime: number;
        subjectId: string;
        teacherUserId: string;
        teacherName: string;
        subjectName: string;
        room: string;
      }>;
    });

    // ── Step 8: Validate & save the generated slots ────────────────────
    const savedCount = await step.run("save-timetable-slots", async () => {
      // Delete existing slots for this grade (will be regenerated)
      await prisma.timetableSlot.deleteMany({
        where: { gradeId },
      });

      // Build a lookup map: userId -> staffProfileId
      const staffProfileMap = new Map<string, string>();
      for (const t of teachers) {
        if (t.staffProfile) {
          staffProfileMap.set(t.id, t.staffProfile.id);
        }
      }

      // Step 8a: Collect all unique (teacher, subject) combinations needed
      const uniqueCombos = new Map<
        string,
        { staffProfileId: string; subjectId: string }
      >();

      const validSlots = aiResult.filter((s) => s.subjectId !== "BREAK");

      for (const slot of validSlots) {
        const staffProfileId = staffProfileMap.get(slot.teacherUserId);
        if (!staffProfileId) {
          console.warn(
            `[Timetable] Skipping slot: no staff profile for user ${slot.teacherUserId} (${slot.teacherName})`,
          );
          continue;
        }
        const key = `${staffProfileId}_${slot.subjectId}`;
        if (!uniqueCombos.has(key)) {
          uniqueCombos.set(key, { staffProfileId, subjectId: slot.subjectId });
        }
      }

      if (uniqueCombos.size === 0) {
        throw new Error("No valid slots generated by AI.");
      }

      // Step 8b: Upsert each unique combo (at most ~25, usually 5-10)
      const tgsMap = new Map<string, string>(); // "staffProfileId_subjectId" -> tgs.id

      for (const [key, combo] of uniqueCombos) {
        const tgs = await prisma.teachergradeSubject.upsert({
          where: {
            teacherId_gradeId_subjectId_academicYearId: {
              teacherId: combo.staffProfileId,
              gradeId,
              subjectId: combo.subjectId,
              academicYearId,
            },
          },
          update: {},
          create: {
            teacherId: combo.staffProfileId,
            gradeId,
            subjectId: combo.subjectId,
            academicYearId,
          },
          select: { id: true },
        });
        tgsMap.set(key, tgs.id);
      }

      // Step 8c: Build all timetable slots and create them in a single batch
      const slotsToCreate = validSlots
        .map((slot) => {
          const staffProfileId = staffProfileMap.get(slot.teacherUserId);
          if (!staffProfileId) return null;
          const key = `${staffProfileId}_${slot.subjectId}`;
          const tgsId = tgsMap.get(key);
          if (!tgsId) return null;

          return {
            teachergradeSubjectId: tgsId,
            teacherId: slot.teacherUserId,
            gradeId,
            room: slot.room || null,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            subjectName: slot.subjectName,
            teacherName: slot.teacherName,
          };
        })
        .filter(Boolean) as Array<{
        teachergradeSubjectId: string;
        teacherId: string;
        gradeId: string;
        room: string | null;
        dayOfWeek: number;
        startTime: number;
        endTime: number;
        subjectName: string;
        teacherName: string;
      }>;

      if (slotsToCreate.length === 0) {
        throw new Error("No valid slots generated by AI.");
      }

      await prisma.timetableSlot.createMany({
        data: slotsToCreate,
      });

      return slotsToCreate.length;
    });

    return {
      message: `Timetable generated for ${gradeInfo.name} - ${gradeInfo.section}`,
      slotsCreated: savedCount,
    };
  },
);
