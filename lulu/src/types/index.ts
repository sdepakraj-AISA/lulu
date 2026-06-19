// ============================================================
// Lulu — Type System
// Single source of truth for all data shapes across the app
// ============================================================

// ------------------------------------------------------------
// Plans
// ------------------------------------------------------------
export type PlanId = 'free' | 'starter' | 'growth' | 'pro';

export const PLANS: Record<PlanId, {
  name: string;
  price: number;           // USD/month
  registryListed: boolean;
  maxConnectors: number;
  analyticsRetentionDays: number;
  features: string[];
}> = {
  free: {
    name: 'Free',
    price: 0,
    registryListed: false,
    maxConnectors: 1,
    analyticsRetentionDays: 7,
    features: [
      'Hosted MCP server',
      '1 connector',
      'Not listed in registry',
      '7-day analytics',
    ],
  },
  starter: {
    name: 'Starter',
    price: 49,
    registryListed: true,
    maxConnectors: 3,
    analyticsRetentionDays: 30,
    features: [
      'Everything in Free',
      'Registry listing (AI-discoverable)',
      '3 connectors',
      '30-day analytics',
      'Email support',
    ],
  },
  growth: {
    name: 'Growth',
    price: 149,
    registryListed: true,
    maxConnectors: 10,
    analyticsRetentionDays: 90,
    features: [
      'Everything in Starter',
      '10 connectors',
      '90-day analytics',
      'Priority support',
      'Attribution tracking',
    ],
  },
  pro: {
    name: 'Pro',
    price: 399,
    registryListed: true,
    maxConnectors: -1,   // unlimited
    analyticsRetentionDays: 365,
    features: [
      'Everything in Growth',
      'Unlimited connectors',
      '1-year analytics',
      'Dedicated support',
      'Custom schema',
      'White-label endpoint',
    ],
  },
};

// ------------------------------------------------------------
// Address
// ------------------------------------------------------------
export interface Address {
  street?: string;
  city?: string;
  province?: string;
  country?: string;
  postal?: string;
}

// ------------------------------------------------------------
// Business Hours
// Key = 3-letter day ('mon', 'tue', ...) | Value = '9:00-17:00' or 'closed'
// ------------------------------------------------------------
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type BusinessHours = Partial<Record<DayKey, string>>;

// ------------------------------------------------------------
// Business
// ------------------------------------------------------------
export type BusinessCategory =
  | 'retail'
  | 'service'
  | 'restaurant'
  | 'health'
  | 'legal'
  | 'real_estate'
  | 'consulting'
  | 'other';

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  category?: BusinessCategory;
  website?: string;
  phone?: string;
  email?: string;
  address?: Address;
  hours?: BusinessHours;
  plan: PlanId;
  registry_listed: boolean;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// Connector
// ------------------------------------------------------------
export type ConnectorType =
  | 'shopify'
  | 'google_business'
  | 'merge_hris'
  | 'square'
  | 'lightspeed'
  | 'manual';

export type ConnectorStatus =
  | 'pending'
  | 'connected'
  | 'error'
  | 'disconnected';

export interface Connector {
  id: string;
  business_id: string;
  type: ConnectorType;
  status: ConnectorStatus;
  merge_account_token?: string;
  last_synced_at?: string;
  sync_error?: string;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// MCP Server
// ------------------------------------------------------------
export type BuildStatus = 'pending' | 'building' | 'live' | 'error';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpServer {
  id: string;
  business_id: string;
  endpoint_url: string;
  tool_schema: McpTool[] | null;
  version: number;
  last_built_at?: string;
  build_status: BuildStatus;
  build_error?: string;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// Registry
// ------------------------------------------------------------
export type McpCapability =
  | 'search_products'
  | 'check_inventory'
  | 'get_pricing'
  | 'get_availability'
  | 'create_booking'
  | 'get_business_info'
  | 'get_hours';

export interface RegistryEntry {
  id: string;
  business_id: string;
  category?: string;
  location?: { city?: string; province?: string; country?: string };
  capabilities: McpCapability[];
  quality_score: number;
  uptime_pct: number;
  avg_response_ms: number;
  total_queries: number;
  last_queried_at?: string;
  listed_at: string;
  updated_at: string;
  // Joined from businesses:
  business?: Business;
  mcp_server?: McpServer;
}

// ------------------------------------------------------------
// Analytics
// ------------------------------------------------------------
export type EventType =
  | 'registry_query'
  | 'mcp_tool_call'
  | 'click_through';

export type AgentName =
  | 'claude'
  | 'chatgpt'
  | 'gemini'
  | 'unknown';

export interface AnalyticsEvent {
  id: string;
  business_id: string;
  event_type: EventType;
  agent_name?: AgentName;
  tool_called?: string;
  query_text?: string;
  response_ms?: number;
  success: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ------------------------------------------------------------
// API Response shapes
// ------------------------------------------------------------
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface RegistrySearchResult {
  businesses: Array<RegistryEntry & {
    business: Business;
    endpoint_url: string;
  }>;
  total: number;
  query: string;
}

// ------------------------------------------------------------
// Onboarding wizard state
// ------------------------------------------------------------
export type OnboardingStep = 1 | 2 | 3;

export interface OnboardingState {
  step: OnboardingStep;
  businessInfo: Partial<Pick<Business, 'name' | 'category' | 'description' | 'website' | 'phone' | 'email' | 'address' | 'hours'>>;
  selectedConnectors: ConnectorType[];
  permissionsApproved: boolean;
}
