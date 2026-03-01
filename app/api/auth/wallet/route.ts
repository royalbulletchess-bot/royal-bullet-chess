import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createSessionToken } from '@/lib/auth/session';

interface WalletAuthBody {
  address: string;
  message: string;
  signature: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: WalletAuthBody = await req.json();
    const { address, message, signature } = body;

    if (!address || !message || !signature) {
      return NextResponse.json(
        { error: 'address, message, and signature are required' },
        { status: 400 }
      );
    }

    // Normalize address to lowercase for consistency
    const normalizedAddress = address.toLowerCase();

    // Verify the signature
    const isMockPayments = process.env.NEXT_PUBLIC_MOCK_PAYMENTS === 'true';

    if (!isMockPayments) {
      const isValid = await verifyMessage({
        address: normalizedAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Validate the message contains the correct address
    if (!message.toLowerCase().includes(normalizedAddress)) {
      return NextResponse.json(
        { error: 'Message does not match wallet address' },
        { status: 400 }
      );
    }

    // Find existing user by wallet_address
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('wallet_address', normalizedAddress)
      .single();

    let user;

    if (existingUser) {
      user = existingUser;
    } else {
      // Also check by farcaster_id (wallet:{address}) pattern
      const walletFid = `wallet:${normalizedAddress}`;
      const { data: fidUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('farcaster_id', walletFid)
        .single();

      if (fidUser) {
        // Update wallet_address if needed
        if (fidUser.wallet_address !== normalizedAddress) {
          await supabaseAdmin
            .from('users')
            .update({ wallet_address: normalizedAddress })
            .eq('id', fidUser.id);
        }
        user = fidUser;
      } else {
        // Create new wallet user
        const shortAddress = `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`;
        const { data: newUser, error } = await supabaseAdmin
          .from('users')
          .insert({
            farcaster_id: walletFid,
            farcaster_username: shortAddress,
            farcaster_avatar: null,
            wallet_address: normalizedAddress,
            elo_rating: 1200,
            balance_usdc: 0,
          })
          .select('*')
          .single();

        if (error || !newUser) {
          console.error('Wallet user creation error:', error);
          return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
          );
        }
        user = newUser;
      }
    }

    // Create session JWT (fid=0 for wallet-only users)
    const sessionToken = await createSessionToken({
      userId: user.id,
      fid: 0,
      username: user.farcaster_username,
    });

    return NextResponse.json({ user, sessionToken });
  } catch (err) {
    console.error('Wallet auth error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
