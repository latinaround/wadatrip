import { Body, Controller, Get, Patch, Post, Req, BadRequestException, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { requireActor } from '@wadatrip/common/security';
import { bearerCredential, createBearerSession, databaseNow, flowContext, lockAuthAccount, revokeAllSessions, revokeSession, sessionTransaction } from '@wadatrip/common/sessions';
import { safeUser as sanitizeUser } from '@wadatrip/common/public-data';
import { verifyFirebaseIdToken } from '../utils/firebase-auth';
import { sendTransactionalEmail } from '../services/email.service';
import { isEmail } from 'class-validator';
import { reserveAuthAttempt, reserveAuthCodeRequest } from '../services/auth-rate-limit.service';
import { consumeAuthCode, issueAuthCode, retireUndeliveredCode } from '../services/auth-otp.service';
import { webCookies } from '@wadatrip/common/web-security';
import { webAuthContext, webCredential } from '../services/web-auth.service';

const EMAIL_FROM = process.env.EMAIL_FROM || '';
const AUTH_CODE_TTL_MINUTES = Number(process.env.AUTH_CODE_TTL_MINUTES ?? 10);
const AUTH_CODE_MAX_ATTEMPTS = Number(process.env.AUTH_CODE_MAX_ATTEMPTS ?? 5);
const AUTH_CODE_PREVIEW = process.env.NODE_ENV === 'test' && process.env.AUTH_CODE_PREVIEW === 'true';

function authFlow(req: any) {
  req?.res?.setHeader?.('Cache-Control', 'no-store');
  const context=webAuthContext(req);if(context)return context.flow;
  if(req?.headers?.origin!==undefined||webCookies(req).any||flowContext(req))throw new UnauthorizedException('Use browser cookie authentication');
  return null;
}
const publicCredential = (value: any) => ({ ...value, user: sanitizeUser(value.user) });
async function issueCredential(tx:any,req:any,userId:string,method:any,verified:boolean,proofAt:Date|null) {
  return webAuthContext(req)?webCredential(tx,req,{id:userId},method,verified,proofAt)
    :publicCredential(await createBearerSession(tx,userId,method,verified,proofAt,null,bearerCredential(req)));
}

function normalizeRole(value: any) {
  return String(value || '').toLowerCase() === 'guide' ? 'guide' : 'traveler';
}

function generateLoginCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function canonicalEmail(value: unknown) {
  const email = typeof value === 'string' ? value.normalize('NFC').trim().toLowerCase() : '';
  if (email.length > 254 || !isEmail(email)) throw new BadRequestException('A valid email is required');
  return email;
}

function codeConfiguration() {
  if (!Number.isSafeInteger(AUTH_CODE_TTL_MINUTES) || AUTH_CODE_TTL_MINUTES < 1 || AUTH_CODE_TTL_MINUTES > 30
    || !Number.isSafeInteger(AUTH_CODE_MAX_ATTEMPTS) || AUTH_CODE_MAX_ATTEMPTS < 1 || AUTH_CODE_MAX_ATTEMPTS > 5) {
    throw new ServiceUnavailableException('Email sign-in protection is not configured correctly');
  }
}

async function sendAuthCodeEmail(opts: { to: string; code: string; role: string }) {
  const subject = opts.role === 'guide' ? 'Your WadaTrip guide sign-in code' : 'Your WadaTrip sign-in code';
  const text = `Your WadaTrip code is ${opts.code}. It expires in ${AUTH_CODE_TTL_MINUTES} minutes.`;
  return sendTransactionalEmail({ to: opts.to, from: EMAIL_FROM, subject, text, logScope: 'auth.code' });
}

function authCodeDeliveryMessage(reason: string) {
  switch (reason) {
    case 'email_not_configured':
      return 'Email sign-in is not configured right now. Please use password sign-in or try again later.';
    case 'email_failed':
    case 'email_error':
      return 'We could not send your sign-in code right now. Please try again in a few minutes.';
    default:
      return 'We could not send your sign-in code right now.';
  }
}

async function getUserFromRequest(req: any) {
  const prisma = getPrisma();
  const actor = await requireActor(req, prisma);
  return prisma.users.findUnique({ where: { id: actor.id } });
}

function getAllowedGoogleAudiences() {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    ...(String(process.env.GOOGLE_ALLOWED_CLIENT_IDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)),
  ].filter(Boolean) as string[];
}

async function verifyGoogleIdToken(idToken: string) {
  const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { id_token: idToken },
    timeout: 10000,
  });

  const payload = response.data || {};
  const email = String(payload.email || '').toLowerCase();
  const emailVerified = String(payload.email_verified || '').toLowerCase() === 'true';
  const audience = String(payload.aud || '');
  const allowedAudiences = getAllowedGoogleAudiences();

  if (!email || !emailVerified) {
    throw new UnauthorizedException('google account email is not verified');
  }

  if (!allowedAudiences.length || !allowedAudiences.includes(audience)) {
    throw new UnauthorizedException('google token audience is invalid');
  }

  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss) || !Number.isFinite(Number(payload.exp)) || Number(payload.exp) <= Date.now() / 1000) {
    throw new UnauthorizedException('google token is invalid');
  }
  return {
    email,
    name: payload.name ? String(payload.name) : null,
    authenticatedAt: Number.isFinite(Number(payload.auth_time)) && Number(payload.auth_time) > 0 ? new Date(Number(payload.auth_time) * 1000) : null,
  };
}

@Controller('auth')
export class AuthController {
  @Post('flow')
  async flow(@Req() req: any) {
    throw new UnauthorizedException('Legacy browser flow is retired');
  }
  @Post('logout')
  async logout(@Req() req: any) {
    authFlow(req);
    req?.res?.setHeader?.('Cache-Control', 'no-store');
    return revokeSession(getPrisma(), req, flowContext(req));
  }
  @Post('logout-all')
  async logoutAll(@Req() req: any) {
    authFlow(req);
    req?.res?.setHeader?.('Cache-Control', 'no-store');
    return revokeAllSessions(getPrisma(), req);
  }
  @Post('request-code')
  async requestCode(@Body() body: any, @Req() req: any) {
    authFlow(req);
    req?.res?.setHeader?.('Cache-Control', 'no-store');
    const email = canonicalEmail(body?.email);
    const role = normalizeRole(body?.role);
    codeConfiguration();

    const prisma = getPrisma();
    await reserveAuthCodeRequest(prisma, email, req);
    const code = generateLoginCode();
    const loginCode = await issueAuthCode(prisma, email, role, code, AUTH_CODE_TTL_MINUTES);

    const emailResult = await sendAuthCodeEmail({ to: email, code, role });
    if (!emailResult.sent && !AUTH_CODE_PREVIEW) {
      await retireUndeliveredCode(prisma, email, loginCode.id);
      throw new ServiceUnavailableException(authCodeDeliveryMessage(emailResult.reason || ''));
    }
    return {
      ok: true,
      channel: 'email',
      expires_in_minutes: AUTH_CODE_TTL_MINUTES,
      ...(emailResult.sent ? {} : { delivery: emailResult.reason }),
      ...(AUTH_CODE_PREVIEW ? { preview_code: code } : {}),
    };
  }

  @Post('verify-code')
  async verifyCode(@Body() body: any, @Req() req: any) {
    authFlow(req);
    const email = canonicalEmail(body?.email);
    const code = String(body?.code || '').trim();
    const name = body?.name ? String(body.name).trim() : null;
    if (!/^\d{6}$/.test(code) || (name && name.length > 120)) {
      throw new BadRequestException('A six-digit code and a name of at most 120 characters are required');
    }
    codeConfiguration();
    const prisma = getPrisma();
    await reserveAuthAttempt(prisma, 'verify', email, req);
    return consumeAuthCode(prisma, email, code, name, AUTH_CODE_MAX_ATTEMPTS,
      async (user, tx, proofAt) => issueCredential(tx,req,user.id,'email_code',true,proofAt));
  }

  @Post('register')
  async register(@Body() body: any, @Req() req: any) {
    authFlow(req);
    const email = canonicalEmail(body?.email);
    const password = String(body?.password || '');
    const name = body?.name ? String(body.name) : null;
    if (!password || password.length > 4096 || (name && name.length > 120)) {
      throw new BadRequestException('email and password are required');
    }

    const prisma = getPrisma();
    await reserveAuthAttempt(prisma, 'register', email, req);
    const exists = await prisma.users.findUnique({ where: { email } });
    if (exists) {
      throw new BadRequestException('email already registered');
    }

    const password_hash = await bcrypt.hash(password, 10);
    return sessionTransaction(prisma, async tx => {
    await lockAuthAccount(tx, email);
    const now = await databaseNow(tx);
    const user = await tx.users.create({
      data: {
        email,
        name,
        password_hash,
        role: normalizeRole(body?.role),
        status: 'active',
      },
    });

    return issueCredential(tx,req,user.id,'password',false,now);
    });
  }

  @Post('login')
  async login(@Body() body: any, @Req() req: any) {
    authFlow(req);
    const email = canonicalEmail(body?.email);
    const password = String(body?.password || '');
    if (!password || password.length > 4096) {
      throw new BadRequestException('email and password are required');
    }

    const prisma = getPrisma();
    await reserveAuthAttempt(prisma, 'login', email, req);
    const started = await databaseNow(prisma);
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user || user.status !== 'active' || !user.password_hash) {
      throw new UnauthorizedException('invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('invalid credentials');
    }

    return sessionTransaction(prisma, async tx => issueCredential(tx,req,user.id,'password',false,started));
  }

  @Post('google')
  async google(@Body() body: any, @Req() req: any) {
    authFlow(req);
    const idToken = String(body?.idToken || body?.id_token || '').trim();
    if (!idToken || idToken.length > 8192) {
      throw new BadRequestException('google id token is required');
    }

    const prisma = getPrisma();
    await reserveAuthAttempt(prisma, 'federated', null, req);
    let googleUser: { email: string; name: string | null; authenticatedAt: Date | null };
    try {
      googleUser = await verifyGoogleIdToken(idToken);
    } catch (error: any) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new UnauthorizedException('google token is invalid');
    }

    return sessionTransaction(prisma, async tx => {
    await lockAuthAccount(tx, googleUser.email);
    let user = await tx.users.findUnique({ where: { email: googleUser.email } });

    if (!user) {
      user = await tx.users.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          role: normalizeRole(body?.role),
          status: 'active',
          last_login_at: new Date(),
        },
      });
    } else {
      if (user.status !== 'active') throw new UnauthorizedException('account is inactive');
      user = await tx.users.update({
        where: { id: user.id },
        data: {
          name: user.name || googleUser.name || undefined,
          last_login_at: new Date(),
        },
      });
    }

    return issueCredential(tx,req,user.id,'google',true,googleUser.authenticatedAt);
    });
  }

  @Post('firebase')
  async firebase(@Body() body: any, @Req() req: any) {
    authFlow(req);
    const idToken = String(body?.idToken || body?.id_token || '').trim();
    if (!idToken || idToken.length > 8192) throw new BadRequestException('firebase id token is required');
    const prisma = getPrisma();
    await reserveAuthAttempt(prisma, 'federated', null, req);
    const identity = await verifyFirebaseIdToken(idToken);
    return sessionTransaction(prisma, async tx => {
    await lockAuthAccount(tx, identity.email);
    let user = await tx.users.findFirst({
      where: { OR: [{ firebase_uid: identity.uid }, { email: identity.email }] },
    });
    if (!user) {
      user = await tx.users.create({
        data: { email: identity.email, firebase_uid: identity.uid, name: identity.name, role: 'traveler', status: 'active', last_login_at: new Date() },
      });
    } else {
      if (user.status !== 'active') throw new UnauthorizedException('account is inactive');
      if (user.email !== identity.email || (user.firebase_uid && user.firebase_uid !== identity.uid)) {
        throw new UnauthorizedException('identity conflicts with existing account');
      }
      user = await tx.users.update({
        where: { id: user.id },
        data: { firebase_uid: identity.uid, name: user.name || identity.name || undefined, last_login_at: new Date() },
      });
    }
    return issueCredential(tx,req,user.id,'firebase',true,identity.authenticatedAt || null);
    });
  }
  @Get('me')
  async me(@Req() req: any) {
    const user = await getUserFromRequest(req);
    if (!user) throw new UnauthorizedException('not authenticated');
    return sanitizeUser(user);
  }

  @Patch('update')
  async update(@Req() req: any, @Body() body: any) {
    const user = await getUserFromRequest(req);
    if (!user) throw new UnauthorizedException('not authenticated');

    const prisma = getPrisma();
    const next: any = {};

    if (body?.name != null) {
      const name = String(body.name).trim();
      if (!name) throw new BadRequestException('name is required');
      if (name.length > 120) throw new BadRequestException('name must be 120 characters or fewer');
      next.name = name;
    }
    if (body?.email != null) {
      next.email = String(body.email).trim().toLowerCase();
      if (!next.email) throw new BadRequestException('email is required');
    }

    if (next.email && next.email !== user.email) {
      throw new BadRequestException('Email changes require a verified email-change flow');
    }

    const updated = await prisma.users.update({
      where: { id: user.id },
      data: next,
    });

    return sanitizeUser(updated);
  }
}
