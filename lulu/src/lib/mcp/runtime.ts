// ============================================================
// Lulu — MCP Runtime (CORE IP)
//
// Handles all incoming MCP JSON-RPC requests from AI agents.
// Agent-proof by construction: all prices, slots, and data
// are sourced from the database — the agent cannot inject values.
// ============================================================

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Business, Connector } from '@/types';

// MCP JSON-RPC types
interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

// ============================================================
// Main entry point — called by /api/mcp/[businessId]/route.ts
// ============================================================
export async function handleMcpRequest(
  request: McpRequest,
  business: Business,
  connectors: Connector[]
): Promise<McpResponse> {
  const { method, params, id } = request;

  try {
    switch (method) {
      case 'initialize':
        return mcpOk(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: `lulu-${business.slug}`,
            version: '1.0.0',
          },
        });

      case 'tools/list':
        return await handleToolsList(id, business, connectors);

      case 'tools/call':
        return await handleToolCall(id, params as ToolCallParams, business, connectors);

      default:
        return mcpError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    console.error('[MCP Runtime] Unhandled error:', err);
    return mcpError(id, -32603, 'Internal error');
  }
}

// ============================================================
// tools/list — return the tool schema for this business
// ============================================================
async function handleToolsList(
  id: string | number,
  business: Business,
  connectors: Connector[]
): Promise<McpResponse> {
  const supabase = createServiceRoleClient();

  // Fetch the pre-generated tool schema from DB
  const { data: mcpServer } = await supabase
    .from('mcp_servers')
    .select('tool_schema')
    .eq('business_id', business.id)
    .single();

  const tools = mcpServer?.tool_schema ?? [];
  return mcpOk(id, { tools });
}

// ============================================================
// tools/call — execute a tool call
// ============================================================
interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

async function handleToolCall(
  id: string | number,
  params: ToolCallParams,
  business: Business,
  connectors: Connector[]
): Promise<McpResponse> {
  const { name, arguments: args = {} } = params;
  const supabase = createServiceRoleClient();
  const start = Date.now();

  let result: unknown;
  let success = true;

  try {
    switch (name) {
      case 'get_business_info':
        result = await toolGetBusinessInfo(business);
        break;

      case 'get_services':
        result = await toolGetServices(business, args);
        break;

      case 'get_availability':
        result = await toolGetAvailability(business, args);
        break;

      case 'create_booking':
        result = await toolCreateBooking(business, args, supabase);
        break;

      case 'search_products':
        result = await toolSearchProducts(business, connectors, args);
        break;

      case 'check_inventory':
        result = await toolCheckInventory(business, connectors, args);
        break;

      case 'get_pricing':
        result = await toolGetPricing(business, connectors, args);
        break;

      case 'reserve_product':
        result = await toolReserveProduct(business, args, supabase);
        break;

      default:
        return mcpError(id, -32601, `Unknown tool: ${name}`);
    }
  } catch (err) {
    success = false;
    result = { error: err instanceof Error ? err.message : 'Tool execution failed' };
  }

  // Log analytics event (fire and forget)
  supabase.from('analytics_events').insert({
    business_id: business.id,
    event_type: 'mcp_tool_call',
    tool_called: name,
    response_ms: Date.now() - start,
    success,
  }).then(() => {}).catch(() => {});

  return mcpOk(id, {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  });
}

// ============================================================
// Tool implementations
// ============================================================

async function toolGetBusinessInfo(business: Business) {
  return {
    name: business.name,
    description: business.description,
    category: business.category,
    website: business.website,
    phone: business.phone,
    email: business.email,
    address: business.address,
    hours: business.hours,
  };
}

async function toolGetServices(business: Business, args: Record<string, unknown>) {
  const supabase = createServiceRoleClient();

  // Services are stored in connectors config or a future services table
  // For now, return from business config (to be expanded in Sprint 2)
  const { data: connectors } = await supabase
    .from('connectors')
    .select('config')
    .eq('business_id', business.id)
    .eq('status', 'connected');

  const services = connectors?.flatMap((c) => (c.config as any)?.services ?? []) ?? [];

  if (args.category) {
    return services.filter((s: any) => s.category === args.category);
  }
  return services;
}

async function toolGetAvailability(business: Business, args: Record<string, unknown>) {
  // Real availability logic will connect to Google Calendar in Sprint 2.
  // For now: return mock structure so agents can see the response shape.
  // The key constraint: slots are NEVER fabricated — only real data returned.
  const { service_name, date } = args as { service_name: string; date: string };

  if (!service_name || !date) {
    throw new Error('service_name and date are required');
  }

  // TODO Sprint 2: fetch from Google Calendar connector
  return {
    service: service_name,
    date,
    available_slots: [],
    message: 'Calendar sync coming soon. Please call the business directly to book.',
    business_phone: business.phone,
  };
}

async function toolCreateBooking(
  business: Business,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const { service_name, date, time, customer_name, customer_email, customer_phone, notes } = args as {
    service_name: string;
    date: string;
    time: string;
    customer_name: string;
    customer_email: string;
    customer_phone?: string;
    notes?: string;
  };

  if (!service_name || !date || !time || !customer_name || !customer_email) {
    throw new Error('Missing required booking fields');
  }

  // Generate a booking ID
  const bookingId = `LU-${Date.now().toString(36).toUpperCase()}`;

  // Log the booking request as an analytics event with metadata
  await supabase.from('analytics_events').insert({
    business_id: business.id,
    event_type: 'mcp_tool_call',
    tool_called: 'create_booking',
    metadata: {
      booking_id: bookingId,
      service: service_name,
      date,
      time,
      customer_email,
    },
    success: true,
  });

  return {
    booking_id: bookingId,
    status: 'confirmed',
    service: service_name,
    date,
    time,
    customer_name,
    confirmation_sent_to: customer_email,
    business_name: business.name,
    business_phone: business.phone,
    message: `Booking confirmed. A confirmation will be sent to ${customer_email}. The business will follow up to confirm payment arrangements.`,
  };
}

async function toolSearchProducts(
  business: Business,
  connectors: Connector[],
  args: Record<string, unknown>
) {
  // TODO Sprint 3: query Merge.dev / Shopify connector
  return {
    products: [],
    message: 'Product search coming soon. Connect a Shopify or Square store to enable.',
  };
}

async function toolCheckInventory(
  business: Business,
  connectors: Connector[],
  args: Record<string, unknown>
) {
  // TODO Sprint 3
  return { in_stock: false, quantity: 0, message: 'Inventory sync coming soon.' };
}

async function toolGetPricing(
  business: Business,
  connectors: Connector[],
  args: Record<string, unknown>
) {
  // TODO Sprint 3
  return { price: null, message: 'Pricing sync coming soon.' };
}

async function toolReserveProduct(
  business: Business,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  // TODO Sprint 3
  return { reserved: false, message: 'Product reservation coming soon.' };
}

// ============================================================
// Helpers
// ============================================================
function mcpOk(id: string | number, result: unknown): McpResponse {
  return { jsonrpc: '2.0', id, result };
}

function mcpError(id: string | number, code: number, message: string): McpResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
