/**
 * Stripe Client — shared Stripe SDK instance
 *
 * Single source of truth for the Stripe client used across the backend:
 * - The @better-auth/stripe plugin (auth.ts) uses it for customer creation
 *   and webhook signature verification.
 * - The payments controller uses it to create one-time Checkout sessions
 *   for school-fee payments.
 *
 * The API version is intentionally left unset so the SDK pins to its own
 * bundled latest version (currently "2026-07-29.dahlia" for stripe@22).
 */

import Stripe from "stripe";

export const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // No explicit apiVersion — uses the SDK's bundled default (latest).
});
