import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import { prisma } from "./prisma.js";
import { ac, roles } from "./permissions.js";
import { stripeClient } from "./stripe.js";
import { handleStripeEvent } from "./stripe-events.js";

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BACKEND_URL!,
  trustedOrigins: [process.env.CLIENT_URL!],
  emailAndPassword: { enabled: true },

  // ─── Rate Limiting ───────────────────────────────────────────────────────
  // Required by the admin plugin to prevent abuse of admin operations.
  rateLimit: {
    enabled: true,
    window: 60, // 60 seconds
    max: 100, // max requests per window
  },

  // ─── Plugins ─────────────────────────────────────────────────────────────
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "STUDENT", // matches our Prisma schema's @default(STUDENT)
    }),
    // ── Stripe (school-fee payments) ──────────────────────────────────────
    // Creates a Stripe customer for every new user on signup and exposes a
    // signature-verified webhook at /api/auth/stripe/webhook. One-time fee
    // payments flow through Stripe Checkout; `onEvent` records successful
    // payments back into our Payment table.
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      // Handle any Stripe webhook event — checkout.session.completed creates
      // the Payment record for a school-fee payment.
      onEvent: handleStripeEvent,
    }),
  ],

  advanced: {
    cookies: {
      session_token: {
        attributes: {
          sameSite: isProduction ? "none" : "lax",
          secure: isProduction,
        },
      },
    },
  },
});
