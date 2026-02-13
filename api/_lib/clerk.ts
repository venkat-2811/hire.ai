import type { VercelRequest } from '@vercel/node';
import * as jose from 'jose';

export interface ClerkUser {
  id: string;
  sessionId: string;
  azp: string;
}

let jwksCache: jose.JWTVerifyGetKey | null = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

async function getJWKS(): Promise<jose.JWTVerifyGetKey> {
  const now = Date.now();
  
  if (jwksCache && now - jwksCacheTime < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  const clerkJwksUrl = process.env.CLERK_JWKS_URL;
  if (!clerkJwksUrl) {
    throw new Error('CLERK_JWKS_URL not configured');
  }

  jwksCache = jose.createRemoteJWKSet(new URL(clerkJwksUrl));
  jwksCacheTime = now;
  
  return jwksCache;
}

export async function verifyClerkToken(req: VercelRequest): Promise<ClerkUser> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);
  
  try {
    const jwks = await getJWKS();
    const clerkIssuer = process.env.CLERK_ISSUER;
    
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: clerkIssuer,
    });

    return {
      id: payload.sub as string,
      sessionId: payload.sid as string,
      azp: payload.azp as string,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid token');
  }
}

export async function getOptionalUser(req: VercelRequest): Promise<ClerkUser | null> {
  try {
    return await verifyClerkToken(req);
  } catch {
    return null;
  }
}
