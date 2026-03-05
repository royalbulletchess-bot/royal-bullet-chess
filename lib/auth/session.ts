import { SignJWT, jwtVerify } from 'jose';

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}
const secret = new TextEncoder().encode(process.env.SESSION_SECRET);

export interface SessionPayload {
  userId: string;
  fid: number;
  username: string;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      fid: payload.fid as number,
      username: payload.username as string,
    };
  } catch {
    return null;
  }
}
