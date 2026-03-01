import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, type SessionPayload } from '@/lib/auth/session';

// ──────── Response helpers ────────

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ──────── Auth middleware ────────

export interface AuthedRequest {
  session: SessionPayload;
}

/**
 * Extract and verify the session token from the Authorization header.
 * Returns the session payload or null.
 */
export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  // Check Authorization header first
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifySessionToken(token);
  }

  // Also check X-Session-Token header (for simpler client usage)
  const sessionToken = req.headers.get('x-session-token');
  if (sessionToken) {
    return verifySessionToken(sessionToken);
  }

  return null;
}

/**
 * Higher-order function that wraps an API handler with auth.
 * Returns 401 if no valid session.
 */
export function withAuth(
  handler: (req: NextRequest, session: SessionPayload) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const session = await getSession(req);
    if (!session) {
      return apiError('Unauthorized', 401);
    }
    return handler(req, session);
  };
}

// ──────── Invite code generator ────────

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
