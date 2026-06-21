'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';

const PLANS = [
  { id: 'starter', label: 'Starter', price: '$49/mo', desc: 'Registry listed + AI discoverable' },
  { id: 'growth',  label: 'Growth',  price: '$149/mo', desc: 'Everything + priority listing' },
  { id: 'pro',     label: 'Pro',     price: '$399/mo', desc: 'Everything + dedicated support' },
];

export default function UpgradePage() {
  const searchParams = useSearchParams();
  const businessId = searchParams.get('businessId');
  const [loading, setLoading] = useState('');

  async function handleUpgrade(plan: string) {
    setLoading(plan);
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, businessId }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else { alert(data.error ?? 'Something went wrong'); setLoading(''); }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-indigo-600">lulu</span>
          <h1 className="text-2xl font-semibold text-gray-900 mt-4">Get discovered by AI agents</h1>
          <p className="text-gray-500 mt-2">Upgrade to appear in Claude, ChatGPT, and Gemini searches</p>
        </div>
        <div className="space-y-3">
          {PLANS.map((p) => (
            <button key={p.id} onClick={() => handleUpgrade(p.id)} disabled={!!loading}
              className="w-full bg-white border-2 border-gray-100 hover:border-indigo-500 rounded-2xl p-5 text-left transition-colors disabled:opacity-50">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900">{p.label}</p>
                  <p className="text-sm text-gray-400">{p.desc}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-indigo-600">{p.price}</p>
                  <p className="text-xs text-gray-400">{loading === p.id ? 'Loading…' : 'Select →'}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <a href="/dashboard" className="block text-center text-sm text-gray-400 mt-6 hover:text-gray-600">← Back to dashboard</a>
      </div>
    </div>
  );
}

// Made with Bob
