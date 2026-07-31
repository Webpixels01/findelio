import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { syncStripeSubscription } from "@/lib/directus-billing";
import {
  BillingConfigurationError,
  getStripeClient,
  getStripeObjectId,
  getStripeWebhookSecret,
} from "@/lib/stripe-billing";

const paymentFailureMetadataKey = "findelio_payment_failure_cancel_scheduled";

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return getStripeObjectId(invoice.parent?.subscription_details?.subscription);
}

async function syncSubscriptionById(subscriptionId: string): Promise<void> {
  const subscription =
    await getStripeClient().subscriptions.retrieve(subscriptionId);

  await syncStripeSubscription(subscription);
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (!subscription.metadata.listing_id) {
    return;
  }

  if (subscription.cancel_at_period_end) {
    await syncStripeSubscription(subscription);
    return;
  }

  const updatedSubscription = await stripe.subscriptions.update(
    subscriptionId,
    {
      cancel_at_period_end: true,
      metadata: {
        [paymentFailureMetadataKey]: "true",
      },
    },
  );

  await syncStripeSubscription(updatedSubscription);
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    return;
  }

  const stripe = getStripeClient();
  let subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (
    subscription.metadata[paymentFailureMetadataKey] === "true" &&
    subscription.status === "active"
  ) {
    subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
      metadata: {
        [paymentFailureMetadataKey]: "",
      },
    });
  }

  await syncStripeSubscription(subscription);
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "missing_signature" }, { status: 400 });
    }

    const payload = await request.text();
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const subscriptionId = getStripeObjectId(
          event.data.object.subscription,
        );

        if (subscriptionId) {
          await syncSubscriptionById(subscriptionId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncStripeSubscription(event.data.object);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      console.warn("Stripe Webhook ist noch nicht konfiguriert:", error.message);
      return NextResponse.json(
        { error: "billing_not_configured" },
        { status: 503 },
      );
    }

    console.error("Stripe Webhook konnte nicht verarbeitet werden:", error);
    return NextResponse.json({ error: "webhook_failed" }, { status: 400 });
  }
}
