import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest';
import { stripeClient } from '@/lib/stripe';
import { SUPABASE_TABLES, INNGEST_EVENTS } from 'shared';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// POST /api/stripe/webhooks
// PAYMENT GATEWAY: ON HOLD — Stripe integration not yet active.
//
// This route is fully implemented and ready to enable once a
// payment gateway decision is made. To activate:
//   1. Run: pnpm add stripe --filter web
//   2. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env
//   3. Remove the early-return guard below
//   4. Point your Stripe dashboard webhook URL here
//
// Handled events (when active):
//   invoice.payment_succeeded → mark paid, create receipt
//   invoice.payment_failed    → mark overdue
//   charge.refunded           → mark refunded
// ============================================================

export async function POST(req: NextRequest) {
  // Gateway on hold — reject all incoming webhook calls until configured
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Payment gateway not yet configured.' },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: 'Missing Stripe signature or webhook secret' },
      { status: 400 }
    );
  }

  let event: any;

  try {
    event = await stripeClient.constructWebhookEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  const supabaseAdmin = getAdminClient();

  try {
    switch (event.type) {
      // --------------------------------------------------------
      case 'invoice.payment_succeeded': {
        const stripeInvoice = event.data.object;
        const stripeInvoiceId = stripeInvoice.id;
        const amountPaid = stripeInvoice.amount_paid;
        const paymentIntentId = stripeInvoice.payment_intent;

        // Idempotency check: skip if receipt already recorded
        const { data: existing } = await supabaseAdmin
          .from(SUPABASE_TABLES.PAYMENT_RECEIPTS)
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (existing) {
          console.log('Payment receipt already recorded, skipping duplicate webhook.');
          break;
        }

        // Find our invoice record
        const { data: invoice } = await supabaseAdmin
          .from(SUPABASE_TABLES.INVOICES)
          .select('id, student_id')
          .eq('stripe_invoice_id', stripeInvoiceId)
          .maybeSingle();

        if (!invoice) {
          console.warn('Invoice not found for Stripe invoice:', stripeInvoiceId);
          break;
        }

        const paidAt = new Date().toISOString();

        // Update invoice to paid
        await supabaseAdmin
          .from(SUPABASE_TABLES.INVOICES)
          .update({ status: 'paid', paid_at: paidAt, updated_at: paidAt })
          .eq('id', invoice.id);

        // Create payment receipt (audit trail)
        await supabaseAdmin.from(SUPABASE_TABLES.PAYMENT_RECEIPTS).insert({
          invoice_id: invoice.id,
          stripe_payment_intent_id: paymentIntentId ?? null,
          amount_cents: amountPaid,
          status: 'succeeded',
          metadata: {
            stripe_invoice_id: stripeInvoiceId,
            stripe_event_id: event.id,
          },
        });

        // Audit log
        await supabaseAdmin.from(SUPABASE_TABLES.AUDIT_LOG).insert({
          action: 'payment_succeeded',
          table_name: 'invoices',
          record_id: invoice.id,
          changes: { amount_paid_cents: amountPaid, stripe_invoice_id: stripeInvoiceId },
        });

        // Trigger Inngest for email receipt
        try {
          await inngest.send({
            name: INNGEST_EVENTS.STRIPE_PAYMENT_SUCCEEDED,
            data: {
              invoiceId: invoice.id,
              studentId: invoice.student_id,
              amountPaidCents: amountPaid,
              stripeInvoiceId,
            },
          });
        } catch (e) {
          console.warn('Inngest payment succeeded event skipped (non-fatal)');
        }

        break;
      }

      // --------------------------------------------------------
      case 'invoice.payment_failed': {
        const stripeInvoice = event.data.object;
        const stripeInvoiceId = stripeInvoice.id;

        const { data: invoice } = await supabaseAdmin
          .from(SUPABASE_TABLES.INVOICES)
          .select('id, student_id')
          .eq('stripe_invoice_id', stripeInvoiceId)
          .maybeSingle();

        if (!invoice) break;

        await supabaseAdmin
          .from(SUPABASE_TABLES.INVOICES)
          .update({ status: 'overdue', updated_at: new Date().toISOString() })
          .eq('id', invoice.id);

        // Create failed receipt record
        await supabaseAdmin.from(SUPABASE_TABLES.PAYMENT_RECEIPTS).insert({
          invoice_id: invoice.id,
          stripe_payment_intent_id: stripeInvoice.payment_intent ?? null,
          amount_cents: stripeInvoice.amount_due,
          status: 'failed',
          metadata: {
            stripe_invoice_id: stripeInvoiceId,
            stripe_event_id: event.id,
            failure_reason: stripeInvoice.last_payment_error?.message ?? 'Unknown',
          },
        });

        // Trigger Inngest for failure notification
        try {
          await inngest.send({
            name: INNGEST_EVENTS.STRIPE_PAYMENT_FAILED,
            data: {
              invoiceId: invoice.id,
              studentId: invoice.student_id,
              stripeInvoiceId,
            },
          });
        } catch (e) {
          console.warn('Inngest payment failed event skipped (non-fatal)');
        }

        break;
      }

      // --------------------------------------------------------
      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;

        if (!paymentIntentId) break;

        // Find and update invoice
        const { data: receipt } = await supabaseAdmin
          .from(SUPABASE_TABLES.PAYMENT_RECEIPTS)
          .select('invoice_id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (receipt) {
          await supabaseAdmin
            .from(SUPABASE_TABLES.INVOICES)
            .update({ status: 'refunded', updated_at: new Date().toISOString() })
            .eq('id', receipt.invoice_id);

          await supabaseAdmin
            .from(SUPABASE_TABLES.PAYMENT_RECEIPTS)
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent_id', paymentIntentId);
        }

        break;
      }

      default:
        // Unhandled event types — return 200 to prevent Stripe retries
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Stripe webhook processing error:', error);
    return NextResponse.json(
      { error: `Webhook processing failed: ${error.message}` },
      { status: 500 }
    );
  }
}
