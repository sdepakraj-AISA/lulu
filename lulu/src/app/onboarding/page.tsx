'use client';
 
import { useState } from 'react';
import { useRouter } from 'next/navigation';
 
const CATEGORIES = [
  { value: 'retail', label: '🛍️ Retail', desc: 'Products, inventory, pricing' },
  { value: 'restaurant', label: '🍽️ Restaurant', desc: 'Menu, hours, reservations' },
  { value: 'service', label: '🔧 Service', desc: 'Bookings, availability, quotes' },
  { value: 'health', label: '🏥 Health & Wellness', desc: 'Appointments, services' },
  { value: 'legal', label: '⚖️ Legal', desc: 'Consultations, practice areas' },
  { value: 'consulting', label: '💼 Consulting', desc: 'Services, availability, rates' },
];
 
type Step = 'category' | 'details' | 'hours' | 'done';
 
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('category');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
 
  const [form, setForm] = useState({
    category: '',
    name: '',
    description: '',
    website: '',
    phone: '',
    email: '',
    address: { street: '', city: '', province: '', country: 'Canada', postal: '' },
    hours: { mon: '9am–5pm', tue: '9am–5pm', wed: '9am–5pm', thu: '9am–5pm', fri: '9am–5pm', sat: 'Closed', sun: 'Closed' },
  });
 
  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }
 
  function setAddress(field: string, value: string) {
    setForm((f) => ({ ...f, address: { ...f.address, [field]: value } }));
  }
 
  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
      setEndpointUrl(data.endpoint_url);
      setStep('done');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
 
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  const DAY_LABELS: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
 
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
 
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-indigo-600">lulu</span>
          <div className="flex justify-center gap-2 mt-4">
            {(['category', 'details', 'hours'] as Step[]).map((s, i) => (
              <div key={s} className={`h-1.5 w-16 rounded-full transition-colors ${
                step === 'done' || ['category','details','hours'].indexOf(step) >= i
                  ? 'bg-indigo-600' : 'bg-gray-200'
              }`} />
            ))}
          </div>
        </div>
 
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
 
          {/* Step 1: Category */}
          {step === 'category' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">What type of business?</h2>
              <p className="text-gray-500 text-sm mb-6">We'll generate the right AI tools for your category.</p>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => { set('category', cat.value); setStep('details'); }}
                    className="text-left p-4 border-2 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors group"
                  >
                    <div className="text-lg mb-1">{cat.label}</div>
                    <div className="text-xs text-gray-400 group-hover:text-indigo-500">{cat.desc}</div>
                  </button>
                ))}
              </div>
            </>
          )}
 
          {/* Step 2: Details */}
          {step === 'details' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Tell us about your business</h2>
              <p className="text-gray-500 text-sm mb-6">AI agents use this to introduce your business to customers.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Business name *</label>
                  <input value={form.name} onChange={(e) => set('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Maple Street Bakery" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Description *</label>
                  <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="We're a family-owned bakery specializing in sourdough and pastries…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
                    <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="+1 416 555 0100" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
                    <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="hello@mybusiness.com" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Website</label>
                  <input value={form.website} onChange={(e) => set('website', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://mybusiness.com" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">City</label>
                    <input value={form.address.city} onChange={(e) => setAddress('city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Toronto" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Province</label>
                    <input value={form.address.province} onChange={(e) => setAddress('province', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="ON" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('category')}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Back
                </button>
                <button onClick={() => { if (form.name && form.description) setStep('hours'); else setError('Name and description are required'); }}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
                  Continue
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </>
          )}
 
          {/* Step 3: Hours */}
          {step === 'hours' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Business hours</h2>
              <p className="text-gray-500 text-sm mb-6">Agents use this to answer "Are you open?" questions.</p>
              <div className="space-y-2">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-8">{DAY_LABELS[day]}</span>
                    <input
                      value={(form.hours as any)[day]}
                      onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [day]: e.target.value } }))}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('details')}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Back
                </button>
                <button onClick={handleSubmit} disabled={loading}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {loading ? 'Creating…' : 'Launch my MCP server →'}
                </button>
              </div>
            </>
          )}
 
          {/* Done */}
          {step === 'done' && (
            <div className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Your MCP server is live!</h2>
              <p className="text-gray-500 text-sm mb-6">
                AI agents can now discover and query your business.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
                <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Your MCP endpoint</p>
                <code className="text-xs text-indigo-600 break-all">{endpointUrl}</code>
              </div>
              <button onClick={() => router.push('/dashboard')}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
                Go to dashboard →
              </button>
            </div>
          )}
 
        </div>
      </div>
    </div>
  );
}

// Made with Bob
