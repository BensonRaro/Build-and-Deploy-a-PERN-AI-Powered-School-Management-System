/**
 * API Client — Base Axios Instance
 *
 * Pre-configured axios instance for all backend API calls.
 * - Base URL shared by the API client, Better Auth client, and EdgeStore
 * - Sends credentials (cookies) with every request for session auth
 * - JSON content type by default
 *
 * Usage:
 *   import { api } from "@/lib/api";
 *   const { data } = await api.get("/users");
 *   const { data } = await api.post("/users", { name: "Jane" });
 */

import axios from "axios";

// ─── Base API URL ─────────────────────────────────────────────────────────────

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─── Axios Instance ───────────────────────────────────────────────────────────

/**
 * Shared axios instance with default configuration.
 * - `withCredentials: true` sends session cookies automatically
 * - `Content-Type: application/json` is set by default
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Response Interceptor ─────────────────────────────────────────────────────

/**
 * Normalize error responses so every API error has a consistent shape.
 * Components can rely on `error.response?.data?.message` always being a string.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const message =
        error.response.data?.message ||
        error.response.data?.error?.message ||
        error.response.statusText ||
        "An unexpected error occurred.";

      // Attach a user-friendly message to the error object
      error.message = message;
    }

    return Promise.reject(error);
  },
);
