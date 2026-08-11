import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  layout("routes/dashboard/Layout.tsx", [
    route("dashboard", "routes/dashboard/Dashboard.tsx"),
    route("dashboard/academic-years", "routes/dashboard/academic-years.tsx"),
    route("dashboard/fee-structure", "routes/dashboard/fee-structure.tsx"),
    route("dashboard/payments", "routes/dashboard/payments.tsx"),
    route("dashboard/invoices", "routes/dashboard/invoices.tsx"),
    route(
      "dashboard/finance-analytics",
      "routes/dashboard/finance-analytics.tsx",
    ),
    route("dashboard/grades", "routes/dashboard/grades.tsx"),
    route("dashboard/subjects", "routes/dashboard/subjects.tsx"),
    route("dashboard/students", "routes/dashboard/students.tsx"),
    route("dashboard/teachers", "routes/dashboard/teachers.tsx"),
    route("dashboard/parents", "routes/dashboard/parents.tsx"),
    route("dashboard/staff", "routes/dashboard/staff.tsx"),
    route("dashboard/assignments", "routes/dashboard/assignments.tsx"),
    route("dashboard/announcements", "routes/dashboard/announcements.tsx"),
    route("dashboard/activity-log", "routes/dashboard/activity-log.tsx"),
    route("dashboard/timetable", "routes/dashboard/timetable.tsx"),
    // Attendance & Library are premium-only — these routes render a simple
    // placeholder page (see routes/dashboard/premium.tsx). Each route needs a
    // unique id because they share the same module file.
    route("dashboard/attendance", "routes/dashboard/premium.tsx", {
      id: "attendance-premium",
    }),
    route("dashboard/library-analytics", "routes/dashboard/premium.tsx", {
      id: "library-analytics-premium",
    }),
    route("dashboard/books", "routes/dashboard/premium.tsx", {
      id: "books-premium",
    }),
    route("dashboard/book-issues", "routes/dashboard/premium.tsx", {
      id: "book-issues-premium",
    }),
  ]),
] satisfies RouteConfig;
