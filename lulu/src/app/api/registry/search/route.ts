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

  // Build query — only return listed businesses
  let dbQuery = supabase
    .from('registry')
    .select(`
      *,
      business:businesses!inner(
        id, name, slug, description, category,
        website, phone, email, address, hours, plan, registry_listed
      ),
      mcp_server:mcp_servers(endpoint_url, build_status)
    `)
    .eq('businesses.registry_listed', true)
    .eq('businesses.is_active', true)
    .eq('mcp_servers.build_status', 'live')
    .order('quality_score', { ascending: false })
    .range(offset, offset + limit - 1);

  // Full-text search
  if (query) {
    dbQuery = dbQuery.textSearch('search_vector', query, {
      type: 'websearch',
      config: 'english',
    });
  }

  // Category filter
  if (category) {
    dbQuery = dbQuery.eq('category', category);
  }

  // City filter
  if (city) {
    dbQuery = dbQuery.contains('location', { city });
  }

  // Capability filter
  if (capability) {
    dbQuery = dbQuery.contains('capabilities', [capability]);
  }

  const { data, error, count } = await dbQuery;

  if (error) {
    console.error('[Registry Search] Error:', error);
    return NextResponse.json(
      { error: 'Registry search failed' },
      { status: 500 }
    );
  }

  // Log registry query (fire and forget)
  const agentName = detectAgent(request.headers.get('user-agent') ?? '');
  supabase.from('analytics_events').insert(
    (data ?? []).map((entry) => ({
      business_id: entry.business_id,
      event_type: 'registry_query',
      agent_name: agentName,
      query_text: query || null,
    }))
  ).then(() => {}, () => {});

  const result: RegistrySearchResult = {
    businesses: (data ?? []).map((entry) => ({
      ...entry,
      business: entry.business as any,
      endpoint_url: (entry.mcp_server as any)?.endpoint_url ?? '',
    })),
    total: count ?? 0,
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
