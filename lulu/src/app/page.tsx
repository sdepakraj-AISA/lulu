import Link from 'next/link';
import { PLANS } from '@/types';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0F0A1E] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="text-xl font-bold text-purple-400">lulu</div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition">
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-24 pb-16 max-w-4xl mx-auto">
        <div className="inline-block bg-purple-900/40 border border-purple-700/50 rounded-full px-4 py-1 text-sm text-purple-300 mb-6">
          The AI discovery layer for SMBs
        </div>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Get discovered by{' '}
          <span className="text-purple-400">AI agents.</span>
          <br />
          In 30 minutes. No code.
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          When a customer asks ChatGPT, Claude, or Gemini for a recommendation,
          will they find your business? Lulu makes sure the answer is yes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/onboarding"
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-8 py-4 rounded-xl text-lg transition"
          >
            List your business free →
          </Link>
          <a
            href="#how-it-works"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 font-semibold px-8 py-4 rounded-xl text-lg transition"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
        <p className="text-gray-400 text-center mb-12">
          Set up once. AI agents find you forever.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Connect your tools',
              desc: 'Link your Shopify store, Google Business Profile, or enter your info manually. Takes under 5 minutes.',
            },
            {
              step: '02',
              title: 'We build your MCP server',
              desc: 'Lulu auto-generates a live API endpoint that any AI agent can query for your products, prices, hours, and availability.',
            },
            {
              step: '03',
              title: 'AI agents discover you',
              desc: "Your business appears in the Lulu registry — the index AI agents search when a customer asks them for a recommendation.",
            },
          ].map((item) => (
            <div key={item.step} className="bg-[#1A1330] border border-[#2D1F4E] rounded-2xl p-6">
              <div className="text-purple-400 font-mono text-sm mb-3">{item.step}</div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Simple pricing</h2>
        <p className="text-gray-400 text-center mb-12">
          Start free. Upgrade when AI traffic starts driving real business.
        </p>
        <div className="grid md:grid-cols-4 gap-4">
          {(Object.entries(PLANS) as [string, typeof PLANS[keyof typeof PLANS]][]).map(([id, plan]) => (
            <div
              key={id}
              className={`rounded-2xl p-6 border ${
                id === 'starter'
                  ? 'bg-purple-900/30 border-purple-600'
                  : 'bg-[#1A1330] border-[#2D1F4E]'
              }`}
            >
              {id === 'starter' && (
                <div className="text-xs text-purple-300 font-medium mb-2 uppercase tracking-wider">
                  Most popular
                </div>
              )}
              <div className="text-lg font-semibold mb-1">{plan.name}</div>
              <div className="text-3xl font-bold mb-1">
                {plan.price === 0 ? 'Free' : `$${plan.price}`}
                {plan.price > 0 && <span className="text-base text-gray-400 font-normal">/mo</span>}
              </div>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-gray-400 flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/onboarding"
                className={`mt-6 block text-center text-sm font-medium py-2 rounded-lg transition ${
                  id === 'starter'
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'border border-gray-700 hover:border-gray-500 text-gray-300'
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 mt-6">
          Free tier gets a live MCP server. Registry listing (AI-discoverability) starts at Starter.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2D1F4E] py-8 px-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Lulu Technologies Inc. · Built for SMBs who want to survive the agent era.
      </footer>
    </div>
  );
}
