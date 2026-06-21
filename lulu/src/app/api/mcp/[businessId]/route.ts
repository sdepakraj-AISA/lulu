// ============================================================
// Lulu — MCP Endpoint
// /api/mcp/[businessId]
//
// This is what AI agents actually call. One route handles all
// businesses — routing is done by businessId (slug or UUID).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { handleMcpRequest } from '@/lib/mcp/runtime';

export async function POST(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const supabase = createServiceRoleClient();
  const { businessId } = params;

  // 1. Authenticate: validate API key from Authorization header
  const authHeader = request.headers.get('authorization');
  const apiKey = authHeader?.replace('Bearer ', '').trim();

  // 2. Look up business by slug or ID
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('*')
    .or(`slug.eq.${businessId},id.eq.${businessId}`)
    .single();

  if (bizError || !business) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Business not found' } },
      { status: 404 }
    );
  }

  // 3. Validate API key (if provided — some tools may call without auth for discovery)
  if (apiKey && apiKey !== business.api_key) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32002, message: 'Invalid API key' } },
      { status: 401 }
    );
  }

  // 4. Parse JSON-RPC request
  let mcpRequest;
  try {
    mcpRequest = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400 }
    );
  }

  // 5. Fetch active connectors for this business
  const { data: connectors } = await supabase
    .from('connectors')
    .select('*')
    .eq('business_id', business.id)
    .eq('status', 'connected');

  // 6. Handle the MCP request
  const response = await handleMcpRequest(mcpRequest, business, connectors ?? []);

  return NextResponse.json(response, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Handle preflight CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Made with Bob
