import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createSessionToken } from '@/lib/auth/session';
import { verifyFarcasterToken } from '@/lib/farcaster/auth';

interface AuthRequestBody {
  farcasterToken: string | null;
  fid?: number;
  username: string;
  displayName?: string;
  avatar?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: AuthRequestBody = await req.json();
    const { farcasterToken, username, displayName, avatar } = body;

    let verifiedFid: number;

    if (farcasterToken) {
      // Production: verify Farcaster Quick Auth token
      const host = req.headers.get('host') || 'localhost';
      const domain = host.split(':')[0]; // Remove port
      const verified = await verifyFarcasterToken(farcasterToken, domain);
      if (!verified) {
        return NextResponse.json({ error: 'Invalid Farcaster token' }, { status: 401 });
      }
      verifiedFid = verified.fid;
    } else if (process.env.NODE_ENV === 'development' && body.fid) {
      // Dev mode: accept FID without verification
      verifiedFid = body.fid;
    } else if (process.env.NODE_ENV === 'development') {
      // Dev mode fallback: use a default test FID
      verifiedFid = 999999;
    } else {
      return NextResponse.json({ error: 'Farcaster token required' }, { status: 401 });
    }

    const farcasterIdStr = String(verifiedFid);

    // Upsert user in database
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('farcaster_id', farcasterIdStr)
      .single();

    let user;

    if (existingUser) {
      // Update username/avatar if changed
      const updates: Record<string, string> = {};
      const resolvedUsername = displayName || username;
      if (resolvedUsername !== existingUser.farcaster_username) {
        updates.farcaster_username = resolvedUsername;
      }
      if (avatar && avatar !== existingUser.farcaster_avatar) {
        updates.farcaster_avatar = avatar;
      }

      if (Object.keys(updates).length > 0) {
        const { data } = await supabaseAdmin
          .from('users')
          .update(updates)
          .eq('id', existingUser.id)
          .select('*')
          .single();
        user = data || existingUser;
      } else {
        user = existingUser;
      }
    } else {
      // Create new user
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
          farcaster_id: farcasterIdStr,
          farcaster_username: displayName || username,
          farcaster_avatar: avatar || null,
          wallet_address: '0x' + '0'.repeat(40), // Placeholder until wallet connect
          elo_rating: 1200,
          balance_usdc: 0,
        })
        .select('*')
        .single();

      if (error || !data) {
        console.error('User creation error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }
      user = data;
    }

    // Create session JWT
    const sessionToken = await createSessionToken({
      userId: user.id,
      fid: verifiedFid,
      username: user.farcaster_username,
    });

    return NextResponse.json({ user, sessionToken });
  } catch (err) {
    console.error('Auth error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
