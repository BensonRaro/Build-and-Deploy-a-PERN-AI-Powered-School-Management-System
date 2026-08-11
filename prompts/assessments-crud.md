# Assessments Full CRUD

## Goal

Create full CRUD for the Assessment model (`title, description?, maxPoints, dueDate`) following the Aura v2 design language from existing pages. The Assessment model is simple with no foreign key relations yet.

## Files to Create

### Backend

#### `backend/src/controllers/assessments.ts`
Standard CRUD controller following the Subjects pattern (list, get, create, update, delete):

- **GET /api/assessments** — List all assessments ordered by dueDate desc
- **GET /api/assessments/:id** — Get a single assessment
- **POST /api/assessments** — Create with validation for title, maxPoints (positive float), dueDate
- **PATCH /api/assessments/:id** — Partial update (title, description, maxPoints, dueDate)
- **DELETE /api/assessments/:id** — Delete an assessment

Each action logs to ActivityLog.

#### `backend/src/routes/assessments.ts`
Route definitions with role-based access:
- GET: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER, STAFF, STUDENT, PARENT
- POST: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER
- PATCH: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER
- DELETE: SUPER_ADMIN, PRINCIPAL

#### `backend/src/server.ts` update
Add `app.use("/api/assessments", assessmentsRouter);`

### Frontend

#### `frontend/app/lib/hooks/use-assessments.ts`
TanStack Query hooks following the subjects pattern:
- `useAssessments()` — GET /api/assessments
- `useAssessment(id)` — GET /api/assessments/:id
- `useCreateAssessment()` — POST /api/assessments
- `useUpdateAssessment()` — PATCH /api/assessments/:id
- `useDeleteAssessment()` — DELETE /api/assessments/:id

Types:
```ts
export interface Assessment {
  id: string;
  title: string;
  description: string | null;
  maxPoints: number;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentPayload {
  title: string;
  description?: string;
  maxPoints: number;
  dueDate: string;
}
```

#### `frontend/app/components/assessments/columns.tsx`
Column builder (`buildAssessmentColumns`):
- **Title** — with gradient clipboard icon, description subtitle
- **Max Points** — number display with badge
- **Due Date** — formatted date with calendar icon
- **Days Remaining** — dynamic countdown chip (green/amber/red)
- **Actions** — Edit/Delete buttons

#### `frontend/app/routes/dashboard/assessments.tsx`
Full page following Aura v2 design with teal/cyan tones:
- **Hero banner** with animated blobs and stat cards (total assessments, upcoming, expired, average points)
- **DataTable** with search, pagination, loading/error/empty states
- **Create/Edit Dialog** with:
  - Title field (with icon)
  - Description textarea
  - Max Points number input
  - Due Date date picker
  - Premium gradient styling matching existing pages

#### `frontend/app/routes.ts` update
Add `route("dashboard/assessments", "routes/dashboard/assessments.tsx")`

## Design

- **Accent color**: Teal/cyan tones (matching the Assessments nav item)
- **Stat cards**: Total, Upcoming (due in future), Overdue, Avg Max Points
- **Dialog**: Teal gradient header strip, icon-enhanced inputs, cancel/save buttons

## Permissions

Matching the sidebar nav item:
- Read: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER, COUNSELOR, STUDENT, PARENT
- Write: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER
- Delete: SUPER_ADMIN, PRINCIPAL

## Edge Cases

- maxPoints must be a positive number
- dueDate should be validated as a valid ISO date
- Description is optional
- Deleting an assessment with associated grades/assignments should be prevented (currently no relations exist)
