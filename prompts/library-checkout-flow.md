# Library — Borrow Flow (Book Issues) — implemented

Second page of the Library module: `/dashboard/book-issues` (sidebar item was
a dead link; now wired). Companion to `prompts/library-books-crud.md`.

## Model decision (user-approved, "choose the best way")

Quantity-based borrowing — no per-copy model:

- `BookIssue` links a borrower (`User`) to a `Book`; `Book.availableCopies` is
  the live availability counter.
- `Book.totalCopies`/`availableCopies` stay the single source of truth for the
  catalog; issue/return adjust the counter inside transactions.
- Borrowers: **every role** (users pick anyone as borrower).
- Overdue: computed **on read** (no background job). An ISSUED issue whose due
  DATE has passed displays as OVERDUE. Fines are auto-calculated on return:
  `DAILY_FINE ($0.50) × whole calendar days past the due date` (time-of-day
  ignored), stored on the issue.
- Loan period: chosen in the Issue dialog (7 / 14 / 21 / 30 days).

## Data model

No schema changes — `BookIssue` already existed (status ISSUED/RETURNED/OVERDUE,
`dueDate`, `returnDate`, `fineAmount Decimal`, `issuedById`).

## API (`backend/src/controllers/book-issues.ts` + `routes/book-issues.ts`)

Mounted at `/api/book-issues` in `server.ts` (imports use `.js` extension).

| Endpoint | Access | Notes |
|---|---|---|
| `GET /api/book-issues` | SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, LIBRARIAN | desk view; `?search=` (title/refNo/borrower), `?status=` active/ISSUED/OVERDUE/RETURNED (precise filters run on the computed status) |
| `GET /api/book-issues/my` | every role (incl. ACCOUNTANT, COUNSELOR) | current user's own history |
| `POST /api/book-issues` | SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, LIBRARIAN | body `{ bookId, userId, dueDate }`; guarded `updateMany(availableCopies gt 0)` decrement + create in one transaction; 409 when out of stock; borrower must be active & not banned |
| `POST /api/book-issues/:id/return` | SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, LIBRARIAN | atomic `updateMany(status in ISSUED/OVERDUE)` flip → only one concurrent return wins; restores copy; computes fine |

Responses map each issue to `{ status (computed), daysLate, fineAmount (number) }`
and include `book` / `user` / `issuedBy`. Overdue math is calendar-day based
(`startOfDay` comparison) — a book due Aug 5 returned Aug 8 is 3 days late
regardless of time of day. Audit: `book:issued`, `book:returned`.

## Frontend

- `hooks/use-book-issues.ts` — `useBookIssues` / `useMyBookIssues` (both support
  `enabled` gating), `useIssueBook`, `useReturnBook`. Issue/return invalidate
  both the issue lists AND `bookKeys.lists()` (availability changed).
- `components/book-issues/columns.tsx` — book (cover/fallback + refNo), borrower
  + role chip, issued/due dates with "X days late", status badge, fine, hover
  Return action.
- `routes/dashboard/book-issues.tsx` — **Aura v2** teal/cyan accent (distinct
  from the amber Books page). Role-aware: staff see the full desk + Issue dialog;
  everyone else sees "My Borrowed Books". Stat cards (Active / Overdue /
  Returned / Fines), status filter pills, Issue dialog (book select with
  in-stock/disabled states, borrower select grouped by role, loan-period select
  with live due-date preview), return confirm with fine preview.
- Route registered in `frontend/app/routes.ts`; sidebar "Book Issues" item now
  reachable by every role (staff additionally get the desk view).
- `useUsers` hook gained an optional `options.enabled` (borrower list is only
  fetched for the staff dialog — the users endpoint 403s for students/parents).

## Edge cases handled

- No copies available → 409 `NO_COPIES_AVAILABLE` (race-safe via guarded decrement).
- Double return → 400 `ALREADY_RETURNED` and copies are NOT double-incremented.
- Overdue return shows/records the exact fine; on-time returns have none.
- Due date cannot be in the past; borrower must be an active, non-banned account.
- Delete of a book is still blocked while any issue is outstanding (books.ts).

## Verification (done)

1. `bunx prisma db push` — DB already in sync (schema was pushed by the previous
   session; Book table had 0 rows so no refNo backfill was needed).
2. Backend + frontend `bun run typecheck` — clean.
3. Controller smoke-test against the real DB: issue decrements copies, 409 when
   out of stock, overdue fine = days × $0.50, double-return guard, on-time
   returns fine-free — ALL CHECKS PASSED.
4. Server module boots with the new routes mounted.

## What "done" looks like

Librarian/principal logs in → Library → Book Issues → sees all loans with status
and fines → Issue Book dialog (book + borrower + loan period) → copy is reserved
and the Books page availability updates → Return on an active loan shows any
overdue fine before confirming → the copy is restored. Any other role sees their
own borrow history.
