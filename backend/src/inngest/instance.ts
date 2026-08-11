/**
 * Inngest Client Singleton
 *
 * Separated from client.ts to avoid circular dependencies when Inngest
 * functions import the client instance.
 *
 * Usage:
 *   import { inngest } from "../instance.js";
 */

import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "pern-sms" });
