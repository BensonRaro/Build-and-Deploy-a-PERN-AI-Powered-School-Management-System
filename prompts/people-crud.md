# People CRUD — Students, Teachers, Parents & Staff

## Goal

Create full CRUD frontend pages for the 4 People categories (Students, Teachers, Parents, Staff) mirroring the "Aura v2" design language from the existing Academic Years, Grades, and Subjects pages.

The **backend** already handles all user CRUD via `GET/POST/PATCH/DELETE /api/users` with role-based profiles. We only need the frontend.

## Files to Create

### 1. `frontend/app/lib/hooks/use-users.ts`
TanStack Query hooks for user CRUD.
- `useUsers(role?)` — GET /api/users (filtered by role, with profile data)
- `useUser(id)` — GET /api/users/:id
- `useCreateUser()` — POST /api/users
- `useUpdateUser()` — PATCH /api/users/:id
- `useDeleteUser()` — DELETE /api/users/:id

**Type interfaces:**
- `User` — matches the backend response shape with profile unions:
  - `studentProfile?: { grade: {id,name,section}, academicYear: {id,name}, admissionNumber, dateOfBirth, gender, bloodGroup, address }`
  - `parentProfile?: { phone, occupation, address }`
  - `staffProfile?: { employeeId, department, qualification, joiningDate }`
  - `_count: { ... }`

### 2. `frontend/app/components/people/columns.tsx`
Column definitions for the People data tables.
- Each role type gets its own column builder (shared helpers extracted)
- `buildStudentColumns()` — name + admission number + grade + gender + academic year
- `buildTeacherColumns()` — name + employee ID + department + qualification  
- `buildParentColumns()` — name + email + phone + occupation
- `buildStaffColumns()` — name + employee ID + department + role badge + joining date

All include Edit/Delete action buttons.

### 3. Route Pages (4 files following the Aura v2 pattern)

**`frontend/app/routes/dashboard/students.tsx`**
- Hero: rose/red tones
- Stats: total students, grades enrolled, academic years, active students
- Form: name, email, password, grade dropdown, academic year dropdown, admission number, date of birth, gender (select), blood group, address

**`frontend/app/routes/dashboard/teachers.tsx`**
- Hero: orange/amber tones  
- Stats: total teachers, departments, qualifications, subjects assigned
- Form: name, email, password, employee ID, department, qualification, joining date

**`frontend/app/routes/dashboard/parents.tsx`**
- Hero: sky/blue tones
- Stats: total parents, linked students, with phone, address coverage
- Form: name, email, password, phone, occupation, address

**`frontend/app/routes/dashboard/staff.tsx`**
- Hero: slate/indigo tones
- Stats: total staff, departments, roles distribution, total employees
- Form: name, email, password, employee ID, department, qualification, joining date

### 4. `frontend/app/routes.ts` (update)
Add the 4 new dashboard routes:
```
route("dashboard/students", "routes/dashboard/students.tsx"),
route("dashboard/teachers", "routes/dashboard/teachers.tsx"),
route("dashboard/parents", "routes/dashboard/parents.tsx"),
route("dashboard/staff", "routes/dashboard/staff.tsx"),
```

## Design Consistency ("Aura v2")

Each page follows the exact same structure as the existing pages:
- **Gradient hero banner** with animated decorative blobs (different accent color per role)
- **Stat cards** (grid of 4, hidden when loading or empty)
- **DataTable** with search, pagination, animated rows, loading/error/empty states
- **Premium Dialog** for create/edit:
  - Gradient header strip matching the page accent
  - Decorative gradient blob in corner
  - Icon-enhanced inputs with gradient focus rings
  - Role-specific form fields
  - Submit/Cancel buttons

### Reuse Strategy

- **StatCard** component is duplicated inline in each page (following the existing pattern)
- **Dialog overlay** follows the same pattern as existing pages
- **Column definitions** are built via builder functions in `people/columns.tsx`
- **Query hooks** are all in `use-users.ts`
- Each page file is self-contained with its form state (following existing convention)

## Form Behaviors

- **Create**: All fields required except optional ones (bloodGroup, address, occupation, etc.)
- **Edit**: Pre-populate all fields, password is NOT editable (separate password reset flow)
- **Auto-select**: Default academic year to current, first grade available
- **Validation**: On the form submit handler before API call
- **Role-specific**: Form shows only the profile fields relevant to that role
- **Gender**: Use shadcn Select component (Male/Female/Other)
- **Grade/Academic Year**: Fetch with existing hooks, display as Select dropdowns

## States

- **Loading**: DataTable shows the Loader component
- **Empty**: "No {type} found" with descriptive message and empty icon
- **Error**: Error state with retry button
- **Saving**: Button shows SparklesIcon with "Saving…" text, buttons disabled
- **Success/failure**: Toast notifications via mutation callbacks

## Edge Cases

- Deleting a user: confirm dialog with warning
- Creating user with existing email: handle 409 conflict error from backend
- Student requires gradeId + academicYearId (verify they exist)
- Staff roles include: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER, LIBRARIAN, ACCOUNTANT, COUNSELOR, STAFF
- Password minimum 6 characters
