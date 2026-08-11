# Attendance — Grade Register + Lesson Register

## Goal

Ship a complete attendance feature: a **daily grade register** (mark every student
in a grade for a given date) and a **per-lesson register** (mark the students of a
grade for a specific lesson in the timetable), with role-aware access, audit
logging, and a polished dashboard page.

## Decisions (confirmed with user)

- **Data model**: extend the existing `StudentAttendance` model — one model serves
  both registers. A nullable `timetableSlotId` + snapshotted lesson context
  (`subjectName`, `dayOfWeek`, `startTime`) distinguish lesson records from the
  daily grade register. Snapshots survive AI timetable regeneration (which
  deletes/recreates slots); `onDelete: SetNull` on the slot link.
- **Access**: scoped teachers. Admins mark anything; TEACHER only their own
  classes/lessons; STAFF & COUNSELOR read-only; PARENT sees their children,
  STUDENT sees themselves; DELETE is SUPER_ADMIN-only (audit integrity).

## Access matrix

| Role | GET register | POST register | PATCH record | DELETE record | GET /my | GET /summary |
|---|---|---|---|---|---|---|
| SUPER_ADMIN | ✅ any | ✅ any | ✅ any | ✅ any | — | ✅ |
| PRINCIPAL | ✅ any | ✅ any | ✅ any | ❌ | — | ✅ |
| VICE_PRINCIPAL | ✅ any | ✅ any | ✅ any | ❌ | — | ✅ |
| TEACHER | ✅ own classes/lessons | ✅ own classes/lessons | ✅ own scope | ❌ | — | ✅ |
| STAFF | ✅ any (read-only) | ❌ | ❌ | ❌ | — | ✅ |
| COUNSELOR | ✅ any (read-only) | ❌ | ❌ | ❌ | — | ✅ |
| PARENT | — | ❌ | ❌ | ❌ | ✅ children | — |
| STUDENT | — | ❌ | ❌ | ❌ | ✅ self | — |

`permissions.ts` additions: `student.attendance: ["read"]`,
`counselor.attendance: ["read"]`. (Everything else already exists.)

## 1. Data model — `backend/prisma/schema.prisma`

Extend `StudentAttendance`:

```prisma
model StudentAttendance {
  id           String           @id @default(cuid())
  studentId    String
  student      StudentProfile   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  gradeId      String
  grade        Grade            @relation(fields: [gradeId], references: [id], onDelete: Cascade)
  date         DateTime         @db.Date
  status       AttendanceStatus
  remarks      String?
  recordedById String
  recordedBy   User             @relation("AttendanceRecorder", fields: [recordedById], references: [id])
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  // ── Lesson context — null for the daily grade register ──────────────
  timetableSlotId String?
  timetableSlot   TimetableSlot? @relation(fields: [timetableSlotId], references: [id], onDelete: SetNull)
  // Denormalized snapshot taken at record time — survives timetable regeneration
  subjectName String?
  dayOfWeek   Int?
  startTime   Int?

  @@unique([studentId, gradeId, date, timetableSlotId])
  @@index([gradeId, date])
  @@index([studentId, date])
  @@index([timetableSlotId, date])
  @@map("student_attendance")
}
```

> Note: `@@unique([studentId, gradeId, date])` is replaced by
> `@@unique([studentId, gradeId, date, timetableSlotId])` — with `NULL`
> `timetableSlotId` Postgres treats NULLs as distinct, so the daily register keeps
> its one-record-per-student-per-day guarantee while lesson records are unique per
> (student, date, lesson).

Also add the back-relation on `TimetableSlot`:
`attendance StudentAttendance[]` (under `TimetableSlot`).

**Migration**: `cd backend && bunx prisma migrate dev --name attendance_lesson_registers`
(needs `backend/.env` with `DATABASE_URL` — the Neon DB from `.env`). If the DB is
unreachable during implementation, surface the exact command + migration SQL as a
manual step instead of failing silently.

## 2. Backend — `backend/src/routes/attendance.ts` + `backend/src/controllers/attendance.ts`

Register in `backend/src/server.ts` (`app.use("/api/attendance", attendanceRouter)`)
with the other routers. All routes behind `requireAuth`; roles per the matrix
above via `requireRole`. `.js` import extensions everywhere.

### Endpoints

**`GET /api/attendance?gradeId=X&date=YYYY-MM-DD`** (or `?timetableSlotId=X&date=...`)
- Returns the **roster** (active `StudentProfile`s in the grade, ordered by name)
  merged with any existing attendance for that date, so the UI can pre-fill.
- Response: `{ data: { scope: "grade" | "lesson", grade: {id,name,section}, date,
  lesson?: { id, subjectName, dayOfWeek, startTime, endTime, teacherName, room },
  students: [{ studentId, name, admissionNumber, gender, status | null, remarks | null, attendanceId | null }] } }`
- Scoping: TEACHER — `gradeId` must appear in their
  `staffProfile.gradeesTaught` (any academic year), or the lesson's
  `timetableSlot.teacherId === user.id`. STAFF/COUNSELOR/ADMIN: any.
- Validation: `gradeId` XOR `timetableSlotId` required; `date` required/valid.

**`POST /api/attendance`** — bulk upsert (atomic `prisma.$transaction`)
- Body: `{ gradeId? | timetableSlotId?, date, entries: [{ studentId, status, remarks? }] }`
- Server derives `gradeId` from the slot when `timetableSlotId` given, and snapshots
  `subjectName`/`dayOfWeek`/`startTime` from the slot at write time.
- Upserts each entry on `(studentId, gradeId, date, timetableSlotId)` — same row
  updates `status`/`remarks`; new rows set `recordedById = req.user.id`.
- Validates: `status ∈ {PRESENT, ABSENT, LATE, EXCUSED}`, all `studentId`s belong
  to the grade, entries non-empty → else 400 `{ error: { code, message } }`.
- Teacher scope check (same as GET). Logs `attendance:register-saved` via
  `logActivityAsync` (count by status, grade name).
- Returns the merged roster (same shape as GET) so the UI updates in place.

**`PATCH /api/attendance/:id`** — single-record correction
- Body: `{ status?, remarks? }`. Scoped (teacher must own the grade/lesson).
- Logs `attendance:record-updated` with before/after.

**`DELETE /api/attendance/:id`** — SUPER_ADMIN only. Logs `attendance:record-deleted`.

**`GET /api/attendance/my?from=&to=`** — STUDENT / PARENT
- STUDENT → their own records; PARENT → linked children's records.
- Response: `{ data: { students: [{ studentId, name, admissionNumber, grade: {name,section}, records: [{ id, date, status, remarks, subjectName?, dayOfWeek?, startTime?, recordedByName }] }] } }`
  (records ordered by date desc, optional `from`/`to` date filters, default last 30 days).

**`GET /api/attendance/summary?gradeId=X&from=&to=`** (or `?timetableSlotId=...`)
- Counts by status + attendance rate for the stat cards.
- Response: `{ data: { total, present, absent, late, excused, rate } }` (rate = present/recorded).

Consistent error shape `{ error: { code, message } }` (matches `requireRole`).

## 3. Frontend

### `frontend/app/lib/hooks/use-attendance.ts` (new)
Local types + query keys + hooks following `use-timetable.ts` conventions:
- `useAttendanceRegister(gradeId | timetableSlotId, date)` — GET `/api/attendance`
- `useSaveAttendance()` — POST (invalidates register + summary + my queries)
- `useUpdateAttendance()` — PATCH `/api/attendance/:id`
- `useDeleteAttendance()` — DELETE (SUPER_ADMIN only)
- `useMyAttendance(from?, to?)` — GET `/api/attendance/my`
- `useAttendanceSummary(gradeId?, timetableSlotId?, from?, to?)`

### `frontend/app/routes/dashboard/attendance.tsx` (new) — "Aura v2" design
Role-aware single page (mirrors the Aura v2 pages: gradient hero, animated blobs,
stat cards, premium tables, glass dialogs):

- **ADMIN / TEACHER** — two tabs:
  - **Grade Register**: academic-year scoped grade select (reuse `useGrades(currentYear.id)`
    pattern from timetable), date input (defaults to today), roster table with a
    status control per row (4-state: Present / Absent / Late / Excused — segmented
    buttons or Select), optional remarks, **Save Register** button (bulk POST).
    Stat cards: Present / Absent / Late / Excused counts + attendance rate.
    TEACHER's grade select shows only grades they teach (`useMyTimetable().classes`).
  - **Lesson Register**: grade select → lesson select (from `useTimetableSlots(gradeId)`,
    labeled e.g. `Mon 09:00–09:40 · Mathematics · Mr. X`), date input, same roster
    table + save. TEACHER's lesson list shows only slots where they're the teacher
    (`useMyTimetable().slots`). Empty state when the grade has no timetable.
- **STAFF / COUNSELOR** — read-only version of both registers (no save button).
- **STUDENT / PARENT** — "My Attendance": list of records (grouped by student for
  parents), with date, status badge, lesson label (when lesson record), recorded-by;
  small summary chips (present/absent counts). Uses `useMyAttendance`.
- Loading / error / empty states on every view (per design system).
- Reuse `DataTable` or build a compact custom roster table (a roster has fixed rows
  with inline controls — a custom table is acceptable, but the stat-card pattern
  from grades/timetable pages is reused).

### Route + sidebar
- `frontend/app/routes.ts`: add `route("dashboard/attendance", "routes/dashboard/attendance.tsx")`.
- `frontend/app/components/dashboard/app-sidebar.tsx`: item already exists at
  `/dashboard/attendance` with roles incl. STUDENT/PARENT/COUNSELOR — no change
  needed (verify roles match the matrix above).

## Edge cases

- Roster uses **active** student profiles only (`active: true`, `deletedAt: null` on user).
- Saving with no statuses changed / empty entries → 400.
- Grade with no timetable → lesson tab shows friendly empty state.
- Timetable regenerated → historical lesson records keep `subjectName`/`dayOfWeek`/`startTime` snapshots; slot link becomes `null`.
- Teachers with no assignments see an empty-grade empty state, not an error.
- Dates are `YYYY-MM-DD` strings everywhere (stored as `@db.Date`).

## Done = 

- Migration applied (or exact manual step surfaced).
- `cd backend && bun run typecheck` passes.
- `cd frontend && bun run typecheck` passes.
- Code-reviewer passes.
- Manual smoke path documented: run backend + frontend, log in as admin → Attendance →
  Grade Register → mark a grade → save → Lesson Register → mark a lesson → save →
  view as parent/student via `/api/attendance/my`.
