// POST /api/stripe/checkout
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

const PLAN_PRICES: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? '',
  growth:  process.env.STRIPE_PRICE_GROWTH  ?? '',
  pro:     process.env.STRIPE_PRICE_PRO     ?? '',
};

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plan, businessId } = await request.json();

  if (!plan || !PLAN_PRICES[plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const serviceClient = createServiceRoleClient();
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id, name, slug')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .single();

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: PLAN_PRICES[plan], quantity: 1 }],
    metadata: {
      businessId: business.id,
      businessSlug: business.slug,
      plan,
      userId: user.id,
    },
    success_url: `${appUrl}/dashboard?upgrade=success&plan=${plan}`,
    cancel_url: `${appUrl}/dashboard?upgrade=cancelled`,
    customer_email: user.email,
  });

  return NextResponse.json({ url: session.url });
}
