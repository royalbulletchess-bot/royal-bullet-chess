import { createClient, Errors } from '@farcaster/quick-auth';

let quickAuthClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!quickAuthClient) {
    quickAuthClient = createClient();
  }
  return quickAuthClient;
}

export interface VerifiedFarcasterUser {
  fid: number;
}

/**
 * Verify a Farcaster Quick Auth JWT token (server-side).
 * Returns the verified FID or null if invalid.
 */
export async function verifyFarcasterToken(
  token: string,
  domain: string
): Promise<VerifiedFarcasterUser | null> {
  try {
    const client = getClient();
    const payload = await client.verifyJwt({ token, domain });
    return { fid: payload.sub };
  } catch (err) {
    if (err instanceof Errors.InvalidTokenError) {
      console.error('Invalid Farcaster token:', err.message);
    } else {
      console.error('Farcaster token verification error:', err);
    }
    return null;
  }
}
