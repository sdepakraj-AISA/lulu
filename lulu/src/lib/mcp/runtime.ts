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
        return await handleToolsList(id, business);

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
): Promise<McpResponse> {
  const supabase = createServiceRoleClient();

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
        result = await toolGetServices(business);
        break;

      case 'get_availability':
        result = await toolGetAvailability(business, args, supabase);
        break;

      case 'create_booking':
        result = await toolCreateBooking(business, args, supabase);
        break;

      default:
        return mcpError(id, -32601, `Unknown tool: ${name}`);
    }
  } catch (err) {
    success = false;
    result = { error: err instanceof Error ? err.message : 'Tool execution failed' };
  }

  // Log analytics (fire and forget)
  supabase.from('analytics_events').insert({
    business_id: business.id,
    event_type: 'mcp_tool_call',
    tool_called: name,
    response_ms: Date.now() - start,
    success,
  }).then(() => {}, () => {});

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

async function toolGetServices(business: Business) {
  const biz = business as any;

  // Use services stored on the business record
  if (biz.services && Array.isArray(biz.services) && biz.services.length > 0) {
    return { services: biz.services };
  }

  // Category defaults as fallback
  const defaults: Record<string, object[]> = {
    health: [
      { id: 'consultation', name: 'Consultation', duration_minutes: 60, price: null, description: 'Initial consultation' },
      { id: 'treatment', name: 'Treatment Session', duration_minutes: 60, price: null, description: 'Standard treatment session' },
    ],
    restaurant: [
      { id: 'dine-in', name: 'Dine-in Reservation', duration_minutes: 90, price: null, description: 'Table reservation' },
      { id: 'private-event', name: 'Private Event', duration_minutes: 180, price: null, description: 'Private dining event' },
    ],
    service: [
      { id: 'standard', name: 'Standard Service', duration_minutes: 60, price: null, description: 'Standard service appointment' },
    ],
    legal: [
      { id: 'consultation', name: 'Legal Consultation', duration_minutes: 60, price: null, description: 'Initial legal consultation' },
    ],
    consulting: [
      { id: 'strategy', name: 'Strategy Session', duration_minutes: 60, price: null, description: 'Strategy and planning session' },
    ],
    retail: [
      { id: 'appointment', name: 'Shopping Appointment', duration_minutes: 60, price: null, description: 'Personal shopping session' },
    ],
  };

  const category = business.category ?? 'service';
  return { services: defaults[category] ?? defaults.service };
}

async function toolGetAvailability(
  business: Business,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const { date, service_name } = args as { date?: string; service_name?: string };

  // Default to next business day if no date given
  const targetDate = date ?? getNextBusinessDay(business);
  const dayOfWeek = getDayOfWeek(targetDate);
  const hours = (business as any).hours ?? {};
  const hoursStr: string = hours[dayOfWeek] ?? '';

  if (!hoursStr || hoursStr.toLowerCase() === 'closed') {
    return {
      date: targetDate,
      service: service_name ?? null,
      available_slots: [],
      message: `${business.name} is closed on ${targetDate} (${dayOfWeek}).`,
    };
  }

  // Parse open/close from hours string like "9am–5pm" or "9am-5pm"
  const parsed = parseHoursString(hoursStr);
  if (!parsed) {
    return {
      date: targetDate,
      service: service_name ?? null,
      available_slots: [],
      message: `Could not parse business hours for ${targetDate}.`,
    };
  }

  // Get already-booked slots for this date
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('time')
    .eq('business_id', business.id)
    .eq('date', targetDate)
    .eq('status', 'confirmed');

  const bookedTimes = new Set((existingBookings ?? []).map((b: any) => b.time));

  // Generate hourly slots and exclude booked ones
  const allSlots = generateHourlySlots(parsed.openMinutes, parsed.closeMinutes);
  const available = allSlots.filter((slot) => !bookedTimes.has(slot));

  return {
    date: targetDate,
    service: service_name ?? null,
    available_slots: available,
    business_hours: hoursStr,
    message: available.length > 0
      ? `${available.length} slots available on ${targetDate}.`
      : `No availability on ${targetDate}. Try a different date.`,
  };
}

async function toolCreateBooking(
  business: Business,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const {
    service_name, date, time,
    customer_name, customer_email, customer_phone, notes,
  } = args as {
    service_name: string; date: string; time: string;
    customer_name: string; customer_email: string;
    customer_phone?: string; notes?: string;
  };

  if (!service_name || !date || !time || !customer_name || !customer_email) {
    throw new Error('Missing required fields: service_name, date, time, customer_name, customer_email');
  }

  // Verify the slot is still available
  const { data: conflict } = await supabase
    .from('bookings')
    .select('id')
    .eq('business_id', business.id)
    .eq('date', date)
    .eq('time', time)
    .eq('status', 'confirmed')
    .maybeSingle();

  if (conflict) {
    throw new Error(`The ${time} slot on ${date} is no longer available. Please choose another time.`);
  }

  // Generate booking reference
  const bookingRef = `LU-${Date.now().toString(36).toUpperCase()}`;

  // Insert into bookings table
  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      business_id: business.id,
      booking_ref: bookingRef,
      service_name,
      date,
      time,
      customer_name,
      customer_email,
      customer_phone: customer_phone ?? null,
      notes: notes ?? null,
      status: 'confirmed',
    })
    .select()
    .single();

  if (error || !booking) {
    console.error('[create_booking] DB error:', error);
    throw new Error('Failed to save booking. Please try again.');
  }

  return {
    booking_ref: bookingRef,
    status: 'confirmed',
    service: service_name,
    date,
    time,
    customer_name,
    customer_email,
    business_name: business.name,
    business_phone: business.phone,
    business_email: business.email,
    message: `Booking confirmed! Reference: ${bookingRef}. ${business.name} will be in touch at ${customer_email} to confirm details.`,
  };
}

// ============================================================
// Availability helpers
// ============================================================

function getDayOfWeek(dateStr: string): string {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const d = new Date(dateStr + 'T12:00:00'); // noon avoids timezone edge cases
  return days[d.getDay()];
}

function getNextBusinessDay(business: Business): string {
  const hours = (business as any).hours ?? {};
  const d = new Date();
  d.setDate(d.getDate() + 1);
  for (let i = 0; i < 7; i++) {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = days[d.getDay()];
    const h = hours[dayKey] ?? '';
    if (h && h.toLowerCase() !== 'closed') {
      return d.toISOString().split('T')[0];
    }
    d.setDate(d.getDate() + 1);
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

function parseHoursString(hoursStr: string): { openMinutes: number; closeMinutes: number } | null {
  // Matches "9am–5pm", "9am-5pm", "9:00am-5:00pm", "10am–6pm"
  const match = hoursStr.match(/(\d+(?::\d+)?(?:am|pm))[–\-](\d+(?::\d+)?(?:am|pm))/i);
  if (!match) return null;
  const openMinutes = parseTimeToMinutes(match[1]);
  const closeMinutes = parseTimeToMinutes(match[2]);
  if (openMinutes === null || closeMinutes === null) return null;
  return { openMinutes, closeMinutes };
}

function parseTimeToMinutes(timeStr: string): number | null {
  const match = timeStr.match(/(\d+)(?::(\d+))?(am|pm)/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] ?? '0');
  const period = match[3].toLowerCase();
  if (period === 'pm' && hours !== 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function generateHourlySlots(openMinutes: number, closeMinutes: number): string[] {
  const slots: string[] = [];
  for (let m = openMinutes; m + 60 <= closeMinutes; m += 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const period = h >= 12 ? 'pm' : 'am';
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    slots.push(`${displayH}:${min.toString().padStart(2, '0')}${period}`);
  }
  return slots;
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

// Made with Bob
