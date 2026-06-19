// Sprint 2: Auth callback route placeholder
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // TODO: Implement auth callback logic
  return NextResponse.redirect(new URL('/dashboard', request.url));
}

// Made with Bob
