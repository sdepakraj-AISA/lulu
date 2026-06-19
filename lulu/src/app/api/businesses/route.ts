// POST /api/businesses — create a new business during onboarding
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { generateMcpSchema } from '@/lib/mcp/schema-generator';
 
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50);
}
 
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
 
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
 
  const body = await request.json();
  const { name, description, category, website, phone, email, address, hours } = body;
 
  if (!name || !category) {
    return NextResponse.json({ error: 'name and category are required' }, { status: 400 });
  }
 
  const serviceClient = createServiceRoleClient();
  const baseSlug = slugify(name);
 
  // Ensure slug uniqueness
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const { data: existing } = await serviceClient
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .single();
    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }
 
  // Create business
  const { data: business, error: bizError } = await serviceClient
    .from('businesses')
    .insert({
      owner_id: user.id,
      name, description, category, website, phone, email, address, hours, slug,
    })
    .select()
    .single();
 
  if (bizError || !business) {
    console.error('[POST /api/businesses]', bizError);
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 });
  }
 
  // Generate MCP tool schema based on category
  const toolSchema = generateMcpSchema(business, []);
  const endpointUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/${slug}`;
 
  // Create MCP server record
  await serviceClient.from('mcp_servers').insert({
    business_id: business.id,
    endpoint_url: endpointUrl,
    tool_schema: toolSchema,
    build_status: 'live',
    last_built_at: new Date().toISOString(),
  });
 
  return NextResponse.json({ business, endpoint_url: endpointUrl }, { status: 201 });
}

// Made with Bob
