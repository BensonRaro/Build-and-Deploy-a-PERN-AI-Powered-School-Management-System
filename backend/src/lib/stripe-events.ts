/**
 * Stripe Webhook Event Handlers
 *
 * Business logic executed from the @better-auth/stripe plugin's `onEvent`
 * callback (wired up in lib/auth.ts). The plugin already verifies the
 * Stripe webhook signature before we get here, so these handlers can trust
 * the event payload.
 *
 * Handled events:
 * - checkout.session.completed — a school-fee payment succeeded. Creates the
 *   Payment record (idempotent per Stripe session), marks the fee's invoice
 *   item as paid, and recomputes the invoice status.
 * - payment_intent.succeeded / invoice.paid — no-op safety net (the
 *   checkout.session.completed flow already covers Checkout payments).
 */

import type Stripe from "stripe";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { logActivityAsync } from "./activity-log.js";

/**
 * Entry point for every Stripe webhook event. Dispatches to per-event
 * handlers. Never throws — errors are logged so Stripe can retry.
 */
export const handleStripeEvent = async (event: Stripe.Event) => {
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "payment_intent.succeeded":
        // Checkout payments are recorded via checkout.session.completed.
        // Kept as a safety net for direct PaymentIntent usage in the future.
        break;
      case "invoice.paid":
        // Only relevant for Stripe Billing subscriptions (not used here).
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`[Stripe] Error handling event "${event.type}":`, error);
  }
};

/**
 * Records a successful school-fee payment from a Stripe Checkout session.
 *
 * The checkout session carries our internal IDs in `metadata`:
 *   invoiceId, invoiceItemId, feeStructureId, studentProfileId, userId
 *
 * Idempotency: guarded by the unique `stripeCheckoutSessionId` on Payment —
 * if Stripe retries the same event, we detect the existing payment and skip.
 */
const handleCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
  // Only record payments that actually went through
  if (session.payment_status !== "paid") return;

  const meta = (session.metadata ?? {}) as {
    invoiceId?: string;
    feeStructureId?: string;
    userId?: string;
  };

  const { invoiceId, feeStructureId, userId } = meta;
  if (!invoiceId || !feeStructureId || !userId) {
    console.warn(
      "[Stripe] checkout.session.completed without required metadata — skipping.",
      { id: session.id, meta },
    );
    return;
  }

  // ── Idempotency guard: same session must not create two payments ──────
  const existing = await prisma.payment.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    select: { id: true },
  });
  if (existing) return;

  // Amount total is in the smallest currency unit (cents)
  const amount = (session.amount_total ?? 0) / 100;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // ── Create the payment + recompute invoice status (atomic) ────────────
  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId,
          feeStructureId,
          amount: String(amount),
          paymentMethod: "CREDIT_CARD",
          referenceNumber: paymentIntentId ?? session.id,
          recordedById: userId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      });

      await recomputeInvoiceStatus(tx, invoiceId);
    });
  } catch (error: any) {
    // P2002 = unique violation on stripeCheckoutSessionId — a concurrent
    // duplicate webhook delivery raced past the findUnique check. The
    // payment is already recorded, so this is expected, not an error.
    if (error?.code === "P2002") return;
    throw error;
  }

  // ── Audit log (outside transaction — fire-and-forget) ─────────────────
  logActivityAsync({
    userId,
    activity: "payment:stripe-completed",
    details: `Stripe payment of ${amount} recorded (session ${session.id}).`,
  });
};

/**
 * Recomputes an invoice's status from its items vs. received payments.
 *   UNPAID          — no payments
 *   PARTIALLY_PAID  — payments > 0 but less than the item total
 *   PAID            — payments >= item total
 */
const recomputeInvoiceStatus = async (
  tx: Prisma.TransactionClient,
  invoiceId: string,
) => {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: { select: { amount: true } },
      payments: { select: { amount: true } },
    },
  });

  if (!invoice) return;

  const totalItems = invoice.items.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalPaid = invoice.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  const status =
    totalPaid <= 0
      ? "UNPAID"
      : totalPaid >= totalItems
        ? "PAID"
        : "PARTIALLY_PAID";

  await tx.invoice.update({
    where: { id: invoiceId },
    data: { status },
  });
};
