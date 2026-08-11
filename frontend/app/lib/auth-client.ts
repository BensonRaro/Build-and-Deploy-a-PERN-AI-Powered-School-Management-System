/**
 * Better Auth Client Configuration
 *
 * Singleton client instance for frontend authentication.
 * Includes the admin client plugin for role-based access control on the client side.
 *
 * Usage (frontend):
 *   import { authClient } from "@/lib/auth-client";
 *   const { data } = await authClient.signIn.email({ email, password });
 */

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

import { ac, roles } from "./permissions";
import { API_BASE_URL } from "./api";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    adminClient({
      ac,
      roles,
    }),
  ],
});
