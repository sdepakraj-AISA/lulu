'use client';

import { useState } from 'react';

const PLANS = [
  { id: 'starter', label: 'Starter', price: '$49/mo' },
  { id: 'growth',  label: 'Growth',  price: '$149/mo' },
  { id: 'pro',     label: 'Pro',     price: '$399/mo' },
];

export default function UpgradeButton({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  async function handleUpgrade(plan: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, businessId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? 'Something went wrong');
        setLoading(false);
      }
    } catch {
      alert('Failed to start checkout');
      setLoading(false);
    }
  }

  if (showPlans) {
    return (
      <div className="flex gap-2 ml-4">
        {PLANS.map((p) => (
          <button
            key={p.id}
            onClick={() => handleUpgrade(p.id)}
            disabled={loading}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
          >
            {p.label} {p.price}
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowPlans(true)}
      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap ml-4 hover:bg-indigo-700"
    >
      Upgrade →
    </button>
  );
}
