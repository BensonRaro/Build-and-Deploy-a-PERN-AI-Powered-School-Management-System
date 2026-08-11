# Library — Books CRUD (first page)

## Goal

Build the first page of the Library module: **Books catalog CRUD** at `/dashboard/books`.
Add books via a dialog that includes a **cover image** (Edgestore upload) and an
auto-generated **book reference number**. The sidebar already has the "Books" and
"Book Issues" items — both are currently dead links; this prompt wires up Books.

## Borrowing model decision (delegated: "choose the best way")

**Decision: keep the quantity-based model already in the schema — `BookIssue` linked
to `Book`, with `Book.availableCopies` as the live counter.** No new copy-level model.

Why:
- The schema was already designed for this (`Book.totalCopies`/`availableCopies`,
  `BookIssue.status`, `BookIssueStatus` enum with ISSUED/RETURNED/OVERDUE).
- Matches "mini library, don't overbuild". A `BookCopy`-per-item model only pays off
  when the library needs to track *which physical copy* is out (barcodes, damage,
  holds) — overkill for this school system now.
- Books CRUD stays independent: creating/editing books just manages copies;
  issue/return (next prompt, `/dashboard/book-issues`) decrements/increments
  `availableCopies` inside a transaction.

This prompt does **not** build the issue/return UI — only the catalog. But the
schema additions below keep the borrow flow cleanly supported.

## Data model changes (`backend/prisma/schema.prisma`)

Add to existing `Book` model:

```prisma
refNo        String   @unique   // auto-generated, e.g. "BK-0001" (immutable after create)
coverImage   String?            // Edgestore URL from the frontend upload
description  String?            // optional blurb
```

No changes to `BookIssue`. Existing rows (if any) need a backfill of `refNo`
before/with the `db push` — check `book.count()`; if > 0, backfill with a one-off
script assigning `BK-0001..BK-000N`.

## API (`backend/src/controllers/books.ts` + `backend/src/routes/books.ts`)

Mount at `/api/books` in `server.ts` (imports use `.js` extension).

| Endpoint | Access | Notes |
|---|---|---|
| `GET /api/books` | SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER, STAFF, LIBRARIAN, STUDENT, PARENT | optional `?search=` (title/author/refNo, case-insensitive), `?category=`; include `_count.bookIssues` (total) and `_count` of active issues |
| `GET /api/books/:id` | same | single book detail |
| `POST /api/books` | SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, LIBRARIAN | **auto-generates `refNo` server-side** |
| `PATCH /api/books/:id` | SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, LIBRARIAN | `refNo` immutable; validate `totalCopies >= availableCopies` |
| `DELETE /api/books/:id` | SUPER_ADMIN, PRINCIPAL | **blocked** if any issue with status ISSUED or OVERDUE exists |

refNo generation (server-side, sequential + collision-safe):
- `BK-` + 4-digit zero-padded next number.
- Next number = max numeric suffix across existing `refNo`s + 1 (survives deletes;
  never reuses a number above the current max).
- Wrap create in a retry: on `P2002` unique violation (concurrent create) increment
  and retry once/twice.

Validation, error shape (`{ error: { code, message } }`), and audit logging
(`book:created`, `book:updated`, `book:deleted` via `logActivityAsync`) mirror the
existing Subjects controller. Delete is `SUPER_ADMIN`/`PRINCIPAL` only per
`permissions.ts` (LIBRARIAN has `library: create/read/update`, no delete).

## Frontend

- `frontend/app/lib/hooks/use-books.ts` — TanStack Query hooks (list with filters,
  get, create, update, delete) following `use-subjects.ts` patterns; types in the
  hook file per existing convention.
- `frontend/app/components/books/columns.tsx` — DataTable columns: cover thumbnail
  (with gradient fallback + initials), refNo badge, title, author, category badge,
  copies (`available / total`), status badge (Available / Out / Low when
  availableCopies === 0 or < total), row actions (Edit / Delete) gated by role.
- `frontend/app/routes/dashboard/books.tsx` — **Aura v2** page mirroring Subjects:
  - Hero banner with animated blobs — **amber** accent (library/book warmth;
    distinct from emerald/rose/indigo pages).
  - Stat cards: Total Titles, Total Copies, Available Now, Out on Loan.
  - `DataTable` with search + category filter + empty/loading/error states.
  - Create/Edit dialog: **cover image upload** (Edgestore `publicFiles.upload`,
    preview + replace + remove), title, author, ISBN (optional), category,
    description, totalCopies. In create mode show a read-only "Reference No —
    auto-generated on save" hint; in edit mode show the immutable refNo.
  - Role-gated "New Book" button + row actions (LIBRARIAN/PRINCIPAL/SUPER_ADMIN
    create+edit; SUPER_ADMIN/PRINCIPAL delete).
  - `DeleteConfirmDialog` with the active-issues warning.
- Register `dashboard/books` in `frontend/app/routes.ts`.

## Edge cases

- `totalCopies` >= 1; cannot reduce `totalCopies` below `availableCopies` (would
  strand issued copies) — reject in PATCH.
- Delete blocked when issues are outstanding (409 `HAS_ASSOCIATIONS`).
- Upload: show inline spinner while uploading; disable submit until upload
  resolves; on remove/change, delete the old Edgestore URL if it was replaced.
- refNo shown in table as a monospace badge for scannability.

## Verification

1. `cd backend && bunx prisma db push` (backfill refNo first if rows exist) + `prisma generate`.
2. Backend + frontend `bun run typecheck`.
3. Smoke-test server boot + route wiring (expect 401 through auth gate).
4. Code review of the diff.

## What "done" looks like

Admin/librarian logs in → Library → Books → sees the catalog table → New Book →
uploads a cover, fills details, saves → book appears with an auto-generated
`BK-000N` refNo → can edit (refNo unchanged) → can delete when no outstanding
issues. Students/parents/staff can browse the catalog read-only.
