import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
 
export const revalidate = 60; // refresh every 60s
 
export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
 
  const serviceClient = createServiceRoleClient();
 
  // Fetch user's businesses
  const { data: businesses } = await serviceClient
    .from('businesses')
    .select('*, mcp_servers(*)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
 
  // If no businesses, redirect to onboarding
  if (!businesses || businesses.length === 0) {
    redirect('/onboarding');
  }
 
  // Fetch analytics for all businesses
  const bizIds = businesses.map((b) => b.id);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
 
  const { data: events } = await serviceClient
    .from('analytics_events')
    .select('business_id, event_type, agent_name, created_at')
    .in('business_id', bizIds)
    .gte('created_at', since);
 
  // Aggregate stats per business
  function statsFor(bizId: string) {
    const bizEvents = events?.filter((e) => e.business_id === bizId) ?? [];
    const queries = bizEvents.filter((e) => e.event_type === 'registry_query').length;
    const toolCalls = bizEvents.filter((e) => e.event_type === 'mcp_tool_call').length;
    const agents = [...new Set(bizEvents.map((e) => e.agent_name).filter(Boolean))];
    return { queries, toolCalls, agents };
  }
 
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Last 7 days</p>
        </div>
        <Link href="/onboarding"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add business
        </Link>
      </div>
 
      <div className="space-y-6">
        {businesses.map((biz) => {
          const stats = statsFor(biz.id);
          const mcpServer = (biz as any).mcp_servers?.[0];
          const isLive = mcpServer?.build_status === 'live';
 
          return (
            <div key={biz.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              {/* Business header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{biz.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isLive ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                    }`}>
                      {isLive ? 'Live' : 'Building'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                      {biz.plan}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">{biz.category} · {biz.address?.city}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 mb-1">MCP endpoint</p>
                  <code className="text-xs text-indigo-500">
                    /api/mcp/{biz.slug}
                  </code>
                </div>
              </div>
 
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">{stats.queries}</p>
                  <p className="text-xs text-gray-400 mt-1">Registry queries</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">{stats.toolCalls}</p>
                  <p className="text-xs text-gray-400 mt-1">Tool calls</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">{stats.agents.length || '—'}</p>
                  <p className="text-xs text-gray-400 mt-1">AI agents</p>
                </div>
              </div>
 
              {/* Agent breakdown */}
              {stats.agents.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-6">
                  {stats.agents.map((agent) => (
                    <span key={agent} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full capitalize">
                      {agent}
                    </span>
                  ))}
                </div>
              )}
 
              {/* Plan upgrade CTA for free tier */}
              {biz.plan === 'free' && (
                <div className="bg-indigo-50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-900">Upgrade to get discovered</p>
                    <p className="text-xs text-indigo-500 mt-0.5">
                      Free plan is not listed in the registry. Upgrade to Starter ($49/mo) to appear in AI agent searches.
                    </p>
                  </div>
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap ml-4 hover:bg-indigo-700">
                    Upgrade →
                  </button>
                </div>
              )}
 
              {/* API key */}
              <div className="mt-4 pt-4 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-1">API key (keep secret)</p>
                <code className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                  {biz.api_key?.substring(0, 20)}••••
                </code>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Made with Bob
