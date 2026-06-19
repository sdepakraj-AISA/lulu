// Sprint 2: Businesses API route placeholder
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // TODO: Implement businesses API logic
  return NextResponse.json({ businesses: [] });
}

export async function POST(request: Request) {
  // TODO: Implement create business logic
  const body = await request.json();
  return NextResponse.json({ success: true, business: body });
}

// Made with Bob
