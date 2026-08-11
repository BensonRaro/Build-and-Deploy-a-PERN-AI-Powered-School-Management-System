import { inngest } from "./instance.js";

// Timetable generation function
import { generateTimetable } from "./functions/timetable.js";

// Assignment question generation function
import { generateAssignmentQuestions } from "./functions/assignments.js";

// Re-export the Inngest client so it can be used by the server and controllers
export { inngest };

// All Inngest functions — registered with the serve() handler in server.ts
export const functions = [generateTimetable, generateAssignmentQuestions];
