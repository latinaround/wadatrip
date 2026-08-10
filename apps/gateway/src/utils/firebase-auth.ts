import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';

const FIREBASE_CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificates: Record<string, string> | null = null;
let certificatesExpireAt = 0;

function cacheLifetimeMs(cacheControl: string | undefined) {
  const seconds = Number(String(cacheControl || '').match(/max-age=(\d+)/)?.[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60 * 60 * 1000;
}

async function getCertificates() {
  if (certificates && Date.now() < certificatesExpireAt) return certificates;
  try {
    const response = await axios.get<Record<string, string>>(FIREBASE_CERT_URL, { timeout: 10000 });
    certificates = response.data;
    certificatesExpireAt = Date.now() + cacheLifetimeMs(response.headers['cache-control']);
    return certificates;
  } catch {
    throw new ServiceUnavailableException('firebase token verification is temporarily unavailable');
  }
}

export type FirebaseIdentity = { uid: string; email: string; name: string | null };

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  if (!projectId) throw new ServiceUnavailableException('firebase authentication is not configured');
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === 'string' || decoded.header.alg !== 'RS256' || !decoded.header.kid) {
    throw new UnauthorizedException('firebase token is invalid');
  }
  const cert = (await getCertificates())[decoded.header.kid];
  if (!cert) throw new UnauthorizedException('firebase token is invalid');
  try {
    const payload = jwt.verify(idToken, cert, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    }) as jwt.JwtPayload;
    const uid = String(payload.sub || '');
    const email = String(payload.email || '').trim().toLowerCase();
    if (!uid || uid.length > 128 || !email || payload.email_verified !== true) {
      throw new UnauthorizedException('firebase account email is not verified');
    }
    return { uid, email, name: payload.name ? String(payload.name) : null };
  } catch (error) {
    if (error instanceof UnauthorizedException) throw error;
    throw new UnauthorizedException('firebase token is invalid');
  }
}