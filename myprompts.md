Let's begin by setting up our **Express** backend and configuring **Nodemon** for development. Express will power our REST API throughout this project, while Nodemon automatically restarts the server whenever we make changes, giving us a faster development workflow. We'll create our server entry point, configure the development scripts, and verify that our Express server is running successfully on port **5000** before we start building the School Management System.
Now that our Express server is up and running, let's configure the essential middleware that every production-ready backend should have. We'll load environment variables with Dotenv, secure our API using Helmet, configure CORS to safely handle requests from our frontend, enable Cookie Parser for authentication, and add Express middleware to parse incoming JSON and form data. By the end of this step, our backend will be secure, well-configured, and ready to start building features.
With our middleware in place, the next step is setting up request logging for development. We'll use Morgan to log every incoming request, including methods like **GET**, **POST**, **PUT**, **PATCH**, and **DELETE**, along with their response status and execution time. This makes it much easier to monitor API activity, debug issues, and verify that our endpoints are working correctly as we build the application.

### Require Authentication

Now let's create our `requireAuth` middleware. This middleware will verify that every incoming request has a valid Better Auth session before allowing access to protected routes. By centralizing authentication in one place, we can secure our API without repeating the same logic across multiple controllers.

### Better Auth Roles

With authentication in place, let's configure role-based access control using Better Auth. We'll define our application roles based on our Prisma schema and assign the appropriate permissions to each one. This gives us a flexible authorization system that's easy to manage as our School Management System continues to grow.

### Check Logged-in User Role

Now that roles are configured, let's check the authenticated user's role before allowing access to specific resources. We'll retrieve the current session, read the user's assigned role, and authorize the request accordingly. This ensures that sensitive actions can only be performed by users with the required permissions. (Allowed roles will be passed as string[])

### Check if user has permission

Based on better-auth permissions, let check if user has permission to fees:read using hasPermission->Better-auth built in function

Let us have activities log CRUD, also create function that we can use across the backend to log events.

# user

Read knowledge.md and build user CRUD. Controller should be able to handle StudentProfile, ParentProfile, StudentGuardian and StaffProfile. e.g if we are creating a student we should also create StudentProfile. Let create user using Better-auth's api and then after that create the profile using prisma(only /backend)

# login

- Update navbar to navigate to login
- Redesign the login page to make it better, elegant and smooth page.
- read Better-auth
- `.agents\skills\better-auth-best-practices\SKILL.md`
- `.agents\skills\better-auth-security-best-practices\SKILL.md`
- `.agents\skills\create-auth\SKILL.md`
- `.agents\skills\email-and-password-best-practices\SKILL.md`Since the login is already setup, handle login using lib/auth-client.ts. On a successfull login use to sonner toast to notify the user then navigate the user to /dashboard. Also remove create an account button(Only login required).

# sidebar

read knowledge.md(shadcn skills included) and based on my backend/prisma/prisma.schema intergrate shadcn sidebar into my project(It should be a custom one, making it different from any other designs out there).

on /frontend/routes/dashboard/Layout.tsx I'm using isPending, design a reusable loader in /components/globals.

read knowledge.md and fetch academic year using tanstack query+axios and display them using tanstack table(already installed) For columns should be set inside components folder, create a new folder based on the route name. I think tanstack table(tag and the other tags) can be be reused so create a table inside /components/globals. Pagination and search should be handled as well. Instead of having another page for Terms, for each terms in an academic year should be handled on a Shadcn Sheet(basically the full Term CRUD).

Make academic year design more custom, but elegant and more attracting(I just want something Stunning and beautiful). Even the diolog and the sheet.

Using academic-year page designs, handle grades full CRUD.

Using academic-year, grades, subjects page designs, handle people(students, teachers, parents and staff) full CRUD.

for the admissioNumber I would like one to be generated during student creation as well as for EmployeeId. Format: Student: Grade/userCount/year(e.g 26) Empoyee: EMP/userCount/year(e.g 26)

Now we handle a key feature, when it's not superadmin,principal or vice-principal and we don't have a current academic-year or term the user should be naviagted to home page with a toast of the issue.
-If user is logged in should not be able to visit login page.

read knowledge.md, AI SDK already installed and Gemini key added on env variables. Since inngest is already setup create an inngest function to generate a timetable using gemini ai(timetable will be generated based on the grade not for the entire school, although during create all timetables should be passed to the ai to avoid collision). On the timetable page, display time table on the selected grade. Make sure it's role-based, admin,principal and vice-principal can click on the lesson, opens up a diolog to edit the lesson. And any other feature forgotten.
If TimetableSlot schema does not fit, you can make changes.

fix when I click Generate with AI(timetable), I get an error toast even though it's a success

read knowledge.md, Now let handle assignments, create assign page, we will also handle assignment generation based on the grade selecte, it can be question with an answer or questions only. When student submit there assignment, they should get instant results(choose the best way to do this). Check the timetable fn the ai model was changed, use the one used in that fn.

read knowledge.md, Update the backend(even the prisma schema) to allow the management a way to add a school fees for every term for each grade.

grades should should now indicate/reflect the fees

read knowledge.md, Allow users to make school fees payments using better-auth webhook and stripe payment plugins. Specifically onEvent that catches stripe webhook.
stripe env added and stripe and stripe@^22.0.0 installed

read knowledge.md, build a role based dashboard. SUPER_ADMIN, principal, vice_principal - Analytics dashboard for the whole school, TEACHER - teacher's timetable(personalized for there classes only) + other relevant info, students - there grade's timetable + other relevant info

read knowledge.md, edgestore already setup. Working on a library management system, first page, books CRUD page. Adding books using a dialog which includes books image, reference no/book-no. When adding a book generate a book ref-no.
Then there is also people borrowing books(Choose the best way to handle this).

<!-- get multi-select from here: https://wds-shadcn-registry.netlify.app/components/multi-select/ -->

create a globals component(reusable) for /frontend/app/components/ui/multi-select.tsx then replace all Select tags using data fetched from db with that global mutli-select component
