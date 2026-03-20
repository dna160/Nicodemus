/**
 * Payment Gateway Helper — Stripe (ON HOLD)
 *
 * Stripe has been evaluated but not yet selected as the payment gateway.
 * This file is a fully-implemented stub — do not delete it.
 *
 * To activate Stripe:
 *   1. pnpm add stripe --filter web
 *   2. Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in .env.local
 *   3. Import stripeClient in enroll/route.ts and restore the customer/invoice steps
 *   4. Remove the 503 guard in /api/stripe/webhooks/route.ts
 *   5. Restore handleStripePaymentSucceeded in apps/workflows/src/index.ts
 *
 * To swap in a different gateway (e.g. PayStack, Flutterwave, Paddle):
 *   Replace this file with a new gateway helper using the same interface:
 *   createCustomer(), createInvoice(), sendInvoice(), constructWebhookEvent()
 */

// Dynamic import to avoid build errors if stripe isn't installed yet
async function getStripe() {
  const Stripe = (await import('stripe')).default;
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover' as const,
  });
}

export interface FeeBreakdown {
  registration_fee_cents: number;
  monthly_tuition_cents: number;
  activity_fees_cents: number;
}

export const stripeClient = {
  // ============================================================
  // Create a Stripe customer for a newly enrolled student
  // ============================================================
  async createCustomer(params: {
    email: string;
    name: string;
    metadata?: Record<string, string>;
  }) {
    const stripe = await getStripe();
    return stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata ?? {},
    });
  },

  // ============================================================
  // Create a Stripe invoice with itemized fee breakdown
  // ============================================================
  async createInvoice(params: {
    customerId: string;
    feeBreakdown: FeeBreakdown;
    dueDate: Date;
    metadata?: Record<string, string>;
  }) {
    const stripe = await getStripe();
    const { feeBreakdown, customerId, dueDate, metadata } = params;

    // Create invoice items for each fee type (only if > 0)
    const itemPromises: Promise<any>[] = [];

    if (feeBreakdown.registration_fee_cents > 0) {
      itemPromises.push(
        stripe.invoiceItems.create({
          customer: customerId,
          amount: feeBreakdown.registration_fee_cents,
          currency: 'usd',
          description: 'Registration Fee',
        })
      );
    }

    if (feeBreakdown.monthly_tuition_cents > 0) {
      itemPromises.push(
        stripe.invoiceItems.create({
          customer: customerId,
          amount: feeBreakdown.monthly_tuition_cents,
          currency: 'usd',
          description: 'Monthly Tuition',
        })
      );
    }

    if (feeBreakdown.activity_fees_cents > 0) {
      itemPromises.push(
        stripe.invoiceItems.create({
          customer: customerId,
          amount: feeBreakdown.activity_fees_cents,
          currency: 'usd',
          description: 'Activity Fees',
        })
      );
    }

    await Promise.all(itemPromises);

    // Create the invoice
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: Math.ceil(
        (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
      metadata: metadata ?? {},
    });

    return invoice;
  },

  // ============================================================
  // Finalize and send invoice to the customer
  // ============================================================
  async sendInvoice(invoiceId: string) {
    const stripe = await getStripe();
    // Finalize first (required before sending)
    const finalized = await stripe.invoices.finalizeInvoice(invoiceId);
    // Send via Stripe (triggers email to customer)
    return stripe.invoices.sendInvoice(finalized.id);
  },

  // ============================================================
  // Retrieve a Stripe invoice (for webhook processing)
  // ============================================================
  async retrieveInvoice(invoiceId: string) {
    const stripe = await getStripe();
    return stripe.invoices.retrieve(invoiceId);
  },

  // ============================================================
  // Construct webhook event from raw body + signature
  // ============================================================
  async constructWebhookEvent(
    rawBody: string,
    signature: string,
    webhookSecret: string
  ) {
    const stripe = await getStripe();
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  },
};
