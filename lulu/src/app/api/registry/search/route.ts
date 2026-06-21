// ============================================================
// Lulu — Registry Search API
// /api/registry/search
//
// The master registry endpoint — what AI agents query to find
// businesses before they know which one to call.
//
// This IS the moat. One endpoint, all listed businesses.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { RegistrySearchResult } from '@/types';

export async function GET(request: NextRequest) {
  const supabase = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q') ?? '';
  const category = searchParams.get('category');
  const city = searchParams.get('city');
  const capability = searchParams.get('capability');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  // Fetch all registry entries with related data
  const { data: registryData, error: registryError } = await supabase
    .from('registry')
    .select('*')
    .order('quality_score', { ascending: false });

  if (registryError) {
    console.error('[Registry Search] Error fetching registry:', registryError);
    return NextResponse.json(
      { error: 'Registry search failed' },
      { status: 500 }
    );
  }

  // Fetch all businesses
  const { data: businessesData, error: businessesError } = await supabase
    .from('businesses')
    .select('*')
    .eq('registry_listed', true);

  if (businessesError) {
    console.error('[Registry Search] Error fetching businesses:', businessesError);
    return NextResponse.json(
      { error: 'Registry search failed' },
      { status: 500 }
    );
  }

  // Fetch all MCP servers
  const { data: mcpServersData, error: mcpServersError } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('build_status', 'live');

  if (mcpServersError) {
    console.error('[Registry Search] Error fetching MCP servers:', mcpServersError);
    return NextResponse.json(
      { error: 'Registry search failed' },
      { status: 500 }
    );
  }

  // Create lookup maps
  const businessMap = new Map(businessesData?.map(b => [b.id, b]) ?? []);
  const mcpServerMap = new Map(mcpServersData?.map(m => [m.business_id, m]) ?? []);

  // Join data in JavaScript and apply filters
  let results = (registryData ?? [])
    .map(entry => {
      const business = businessMap.get(entry.business_id);
      const mcpServer = mcpServerMap.get(entry.business_id);
      
      if (!business || !mcpServer) return null;
      
      return {
        ...entry,
        business,
        mcp_server: mcpServer,
      };
    })
    .filter(entry => entry !== null);

  // Apply filters in JavaScript
  if (query) {
    const lowerQuery = query.toLowerCase();
    results = results.filter(entry =>
      entry.business.name?.toLowerCase().includes(lowerQuery) ||
      entry.business.description?.toLowerCase().includes(lowerQuery)
    );
  }

  if (category) {
    results = results.filter(entry => entry.category === category);
  }

  if (city) {
    results = results.filter(entry => entry.location?.city === city);
  }

  if (capability) {
    results = results.filter(entry =>
      entry.capabilities?.includes(capability)
    );
  }

  // Apply pagination
  const total = results.length;
  const data = results.slice(offset, offset + limit);

  if (!data) {
    return NextResponse.json(
      { error: 'No results found' },
      { status: 404 }
    );
  }

  // Log registry query (fire and forget)
  const agentName = detectAgent(request.headers.get('user-agent') ?? '');
  supabase.from('analytics_events').insert(
    data.map((entry) => ({
      business_id: entry.business_id,
      event_type: 'registry_query',
      agent_name: agentName,
      query_text: query || null,
    }))
  ).then(() => {}, () => {});

  const result: RegistrySearchResult = {
    businesses: data.map((entry) => ({
      ...entry,
      business: entry.business as any,
      endpoint_url: entry.mcp_server?.endpoint_url ?? '',
    })),
    total,
    query,
  };

  return NextResponse.json(result, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}

// POST version for more complex queries (MCP tool call format)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const url = new URL(request.url);

  // Accept both direct params and MCP tool call format
  const q = body.query ?? body.q ?? '';
  url.searchParams.set('q', q);
  if (body.category) url.searchParams.set('category', body.category);
  if (body.city) url.searchParams.set('city', body.city);
  if (body.capability) url.searchParams.set('capability', body.capability);
  if (body.limit) url.searchParams.set('limit', String(body.limit));

  return GET(new NextRequest(url, { headers: request.headers }));
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Detect which AI agent is making the request
function detectAgent(userAgent: string): 'claude' | 'chatgpt' | 'gemini' | 'unknown' {
  const ua = userAgent.toLowerCase();
  if (ua.includes('claude') || ua.includes('anthropic')) return 'claude';
  if (ua.includes('chatgpt') || ua.includes('openai')) return 'chatgpt';
  if (ua.includes('gemini') || ua.includes('google')) return 'gemini';
  return 'unknown';
}
