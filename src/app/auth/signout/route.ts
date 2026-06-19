// Sprint 2: Sign out route placeholder
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // TODO: Implement sign out logic
  return NextResponse.redirect(new URL('/auth/login', request.url));
}

// Made with Bob
