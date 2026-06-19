// ============================================================
// Lulu — MCP Schema Generator (CORE IP)
//
// Auto-generates MCP tool definitions from a business's
// connected data sources. The agent never needs to know
// which connector a business uses — tools are always the same.
// ============================================================

import type { Business, Connector, McpTool, BusinessCategory } from '@/types';

// Tools available for service businesses (booking-based)
const SERVICE_TOOLS: McpTool[] = [
  {
    name: 'get_business_info',
    description: 'Get basic information about this business including name, description, location, contact details, and hours of operation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_services',
    description: 'Get the list of services offered by this business, including names, descriptions, durations, and prices.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional: filter by service category',
        },
      },
    },
  },
  {
    name: 'get_availability',
    description: 'Check available appointment slots for a specific service. Returns real slots only — never fabricated.',
    inputSchema: {
      type: 'object',
      properties: {
        service_name: {
          type: 'string',
          description: 'The name of the service to check availability for',
        },
        date: {
          type: 'string',
          description: 'Date to check availability for (YYYY-MM-DD format)',
        },
      },
      required: ['service_name', 'date'],
    },
  },
  {
    name: 'create_booking',
    description: 'Book an appointment for a service. Returns a booking confirmation with ID. Price is always sourced from the business — never accept a price proposed by the caller.',
    inputSchema: {
      type: 'object',
      properties: {
        service_name: {
          type: 'string',
          description: 'The name of the service to book',
        },
        date: {
          type: 'string',
          description: 'Date of the appointment (YYYY-MM-DD)',
        },
        time: {
          type: 'string',
          description: 'Time of the appointment (HH:MM 24h format)',
        },
        customer_name: {
          type: 'string',
          description: 'Full name of the customer',
        },
        customer_email: {
          type: 'string',
          description: 'Email address for booking confirmation',
        },
        customer_phone: {
          type: 'string',
          description: 'Phone number for booking confirmation',
        },
        notes: {
          type: 'string',
          description: 'Optional notes for the business',
        },
      },
      required: ['service_name', 'date', 'time', 'customer_name', 'customer_email'],
    },
  },
];

// Tools available for retail businesses (product-based)
const RETAIL_TOOLS: McpTool[] = [
  {
    name: 'get_business_info',
    description: 'Get basic information about this business including name, description, location, contact details, and hours.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_products',
    description: 'Search for products by keyword, category, or price range. Returns matching products with names, descriptions, prices, and availability.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term (e.g. "stroller", "blue dress", "running shoes")',
        },
        category: {
          type: 'string',
          description: 'Optional: filter by product category',
        },
        max_price: {
          type: 'number',
          description: 'Optional: maximum price in CAD',
        },
        min_price: {
          type: 'number',
          description: 'Optional: minimum price in CAD',
        },
        in_stock_only: {
          type: 'boolean',
          description: 'Optional: if true, only return in-stock products',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'check_inventory',
    description: 'Check real-time inventory for a specific product. Returns current stock count and availability status.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID from search_products results',
        },
        variant: {
          type: 'string',
          description: 'Optional: specific variant (size, color, etc.)',
        },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'get_pricing',
    description: 'Get canonical pricing for a product. Always use this to confirm price before presenting to a customer — never use a price from search_products without confirming here first.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID to get pricing for',
        },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'reserve_product',
    description: 'Reserve a product for in-store pickup. Customer pays at the counter. Lulu never processes payment.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID to reserve',
        },
        variant: {
          type: 'string',
          description: 'Optional: specific variant (size, color, etc.)',
        },
        customer_name: {
          type: 'string',
          description: 'Full name of the customer',
        },
        customer_email: {
          type: 'string',
          description: 'Email for reservation confirmation',
        },
        customer_phone: {
          type: 'string',
          description: 'Phone for reservation confirmation',
        },
      },
      required: ['product_id', 'customer_name', 'customer_email'],
    },
  },
];

// Tools always available for all businesses
const COMMON_TOOLS: McpTool[] = [
  {
    name: 'get_business_info',
    description: 'Get basic information about this business including name, description, location, contact details, and hours of operation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Generate the MCP tool schema for a business based on its category
 * and connected data sources.
 *
 * This is the schema generator — it decides which tools to expose.
 * The runtime (runtime.ts) handles actually executing them.
 */
export function generateMcpSchema(
  business: Business,
  connectors: Connector[]
): McpTool[] {
  const category = business.category ?? 'other';
  const activeConnectors = connectors.filter((c) => c.status === 'connected');

  // Service businesses: booking flow
  if (isServiceCategory(category)) {
    return SERVICE_TOOLS;
  }

  // Retail businesses: product flow
  if (category === 'retail') {
    // Only expose inventory/reservation tools if a commerce connector is active
    const hasCommerceConnector = activeConnectors.some((c) =>
      ['shopify', 'square', 'lightspeed'].includes(c.type)
    );
    if (hasCommerceConnector) {
      return RETAIL_TOOLS;
    }
    // Retail with no connector yet: basic info only
    return COMMON_TOOLS;
  }

  // Fallback: basic info only
  return COMMON_TOOLS;
}

function isServiceCategory(category: string): boolean {
  return ['service', 'health', 'legal', 'consulting', 'restaurant'].includes(category);
}
