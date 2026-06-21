// POST /api/webhooks/stripe
// Handles Stripe webhook events — upgrades plan + flips registry_listed
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('[Stripe Webhook] Invalid signature:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const serviceClient = createServiceRoleClient();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.CheckoutSession;
    const { businessId, plan } = session.metadata ?? {};

    if (!businessId || !plan) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const registryListed = ['starter', 'growth', 'pro'].includes(plan);

    // Update business plan + registry listing
    const { error } = await serviceClient
      .from('businesses')
      .update({
        plan,
        registry_listed: registryListed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId);

    if (error) {
      console.error('[Stripe Webhook] Failed to update business:', error);
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
    }

    // If starter+, add to registry
    if (registryListed) {
      const { data: business } = await serviceClient
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (business) {
        await serviceClient
          .from('registry')
          .upsert({
            business_id: businessId,
            category: business.category,
            location: business.address,
            capabilities: getCapabilities(business.category),
            quality_score: 100,
            listed_at: new Date().toISOString(),
          }, { onConflict: 'business_id' });
      }
    }

    console.log(`[Stripe Webhook] Business ${businessId} upgraded to ${plan}, listed=${registryListed}`);
  }

  return NextResponse.json({ received: true });
}

function getCapabilities(category: string): string[] {
  if (['retail'].includes(category)) {
    return ['search_products', 'check_inventory', 'get_pricing', 'get_business_info'];
  }
  return ['get_business_info', 'get_services', 'get_availability', 'create_booking'];
}

export const config = { api: { bodyParser: false } };
