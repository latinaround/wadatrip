import { Body, Controller, Get, Patch, Post, Req, BadRequestException, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getJwtSecret, getUserIdFromAuth } from '../utils/auth';
import { verifyFirebaseIdToken } from '../utils/firebase-auth';

const TOKEN_TTL_SECONDS = Number(process.env.JWT_TTL_SECONDS) || 60 * 60 * 24 * 7;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const AUTH_CODE_TTL_MINUTES = Number(process.env.AUTH_CODE_TTL_MINUTES) || 10;
const AUTH_CODE_MAX_ATTEMPTS = Number(process.env.AUTH_CODE_MAX_ATTEMPTS) || 5;
const AUTH_CODE_PREVIEW = (process.env.AUTH_CODE_PREVIEW || '').toLowerCase() === 'true';

function signToken(user: any) {
  const secret = getJwtSecret() as jwt.Secret;
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: TOKEN_TTL_SECONDS },
  );
}

function normalizeRole(value: any) {
  return String(value || '').toLowerCase() === 'guide' ? 'guide' : 'traveler';
}

function generateLoginCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashLoginCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function sendAuthCodeEmail(opts: { to: string; code: string; role: string }) {
  if (!SENDGRID_API_KEY || !EMAIL_FROM) {
    return { sent: false, reason: 'email_not_configured' };
  }
  const subject = opts.role === 'guide' ? 'Your WadaTrip guide sign-in code' : 'Your WadaTrip sign-in code';
  const text = `Your WadaTrip code is ${opts.code}. It expires in ${AUTH_CODE_TTL_MINUTES} minutes.`;
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }] }],
        from: { email: EMAIL_FROM },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[auth.code] Email failed', response.status, errText);
      return { sent: false, reason: 'email_failed' };
    }
    return { sent: true };
  } catch (err: any) {
    console.error('[auth.code] Email error', err?.message || err);
    return { sent: false, reason: 'email_error' };
  }
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

function sanitizeUser(user: any) {
  if (!user) return user;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

async function getUserFromRequest(req: any) {
  const userId = getUserIdFromAuth(req);
  if (!userId) return null;
  const prisma = getPrisma();
  return prisma.users.findUnique({ where: { id: String(userId) } });
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

  if (allowedAudiences.length && !allowedAudiences.includes(audience)) {
    throw new UnauthorizedException('google token audience is invalid');
  }

  return {
    email,
    name: payload.name ? String(payload.name) : null,
  };
}

@Controller('auth')
export class AuthController {
  @Post('request-code')
  async requestCode(@Body() body: any) {
    const email = String(body?.email || '').trim().toLowerCase();
    const role = normalizeRole(body?.role);
    const name = body?.name ? String(body.name).trim() : null;
    if (!email) {
      throw new BadRequestException('email is required');
    }

    const prisma = getPrisma();
    const existingUser = await prisma.users.findUnique({ where: { email } });
    const code = generateLoginCode();
    const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MINUTES * 60 * 1000);

    const loginCode = await prisma.auth_login_codes.create({
      data: {
        email,
        code_hash: hashLoginCode(code),
        role,
        expires_at: expiresAt,
        user_id: existingUser?.id || null,
      },
    });

    const emailResult = await sendAuthCodeEmail({ to: email, code, role });
    if (!emailResult.sent && !AUTH_CODE_PREVIEW) {
      await prisma.auth_login_codes.delete({ where: { id: loginCode.id } }).catch(() => null);
      throw new ServiceUnavailableException(authCodeDeliveryMessage(emailResult.reason || ''));
    }
    return {
      ok: true,
      channel: 'email',
      expires_in_minutes: AUTH_CODE_TTL_MINUTES,
      account_hint: existingUser ? 'existing_user' : 'new_user',
      name_hint: name || undefined,
      ...(emailResult.sent ? {} : { delivery: emailResult.reason }),
      ...(AUTH_CODE_PREVIEW ? { preview_code: code } : {}),
    };
  }

  @Post('verify-code')
  async verifyCode(@Body() body: any) {
    const email = String(body?.email || '').trim().toLowerCase();
    const code = String(body?.code || '').trim();
    const role = normalizeRole(body?.role);
    const name = body?.name ? String(body.name).trim() : null;
    if (!email || !code) {
      throw new BadRequestException('email and code are required');
    }

    const prisma = getPrisma();
    const loginCode = await prisma.auth_login_codes.findFirst({
      where: {
        email,
        used_at: null,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!loginCode) {
      throw new UnauthorizedException('code is invalid');
    }
    if (loginCode.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('code expired');
    }
    if (loginCode.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
      throw new UnauthorizedException('too many attempts');
    }

    const matches = loginCode.code_hash === hashLoginCode(code);
    if (!matches) {
      await prisma.auth_login_codes.update({
        where: { id: loginCode.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('code is invalid');
    }

    let user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.users.create({
        data: {
          email,
          name,
          role,
          status: 'active',
          last_login_at: new Date(),
        },
      });
    } else {
      user = await prisma.users.update({
        where: { id: user.id },
        data: {
          name: user.name || name || undefined,
          last_login_at: new Date(),
        },
      });
    }

    await prisma.auth_login_codes.update({
      where: { id: loginCode.id },
      data: {
        used_at: new Date(),
        user_id: user.id,
      },
    });

    const token = signToken(user);
    return { token, user: sanitizeUser(user) };
  }

  @Post('register')
  async register(@Body() body: any) {
    const email = String(body?.email || '').toLowerCase();
    const password = String(body?.password || '');
    const name = body?.name ? String(body.name) : null;
    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }

    const prisma = getPrisma();
    const exists = await prisma.users.findUnique({ where: { email } });
    if (exists) {
      throw new BadRequestException('email already registered');
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        email,
        name,
        password_hash,
        role: normalizeRole(body?.role),
        status: 'active',
      },
    });

    const token = signToken(user);
    return { token, user: sanitizeUser(user) };
  }

  @Post('login')
  async login(@Body() body: any) {
    const email = String(body?.email || '').toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }

    const prisma = getPrisma();
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('invalid credentials');
    }

    await prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const token = signToken(user);
    return { token, user: sanitizeUser(user) };
  }

  @Post('google')
  async google(@Body() body: any) {
    const idToken = String(body?.idToken || body?.id_token || '').trim();
    if (!idToken) {
      throw new BadRequestException('google id token is required');
    }

    let googleUser: { email: string; name: string | null };
    try {
      googleUser = await verifyGoogleIdToken(idToken);
    } catch (error: any) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new UnauthorizedException('google token is invalid');
    }

    const prisma = getPrisma();
    let user = await prisma.users.findUnique({ where: { email: googleUser.email } });

    if (!user) {
      user = await prisma.users.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          role: normalizeRole(body?.role),
          status: 'active',
          last_login_at: new Date(),
        },
      });
    } else {
      user = await prisma.users.update({
        where: { id: user.id },
        data: {
          name: user.name || googleUser.name || undefined,
          last_login_at: new Date(),
        },
      });
    }

    const token = signToken(user);
    return { token, user: sanitizeUser(user) };
  }

  @Post('firebase')
  async firebase(@Body() body: any) {
    const idToken = String(body?.idToken || body?.id_token || '').trim();
    if (!idToken) throw new BadRequestException('firebase id token is required');
    const identity = await verifyFirebaseIdToken(idToken);
    const prisma = getPrisma();
    let user = await prisma.users.findFirst({
      where: { OR: [{ firebase_uid: identity.uid }, { email: identity.email }] },
    });
    if (!user) {
      user = await prisma.users.create({
        data: { email: identity.email, firebase_uid: identity.uid, name: identity.name, role: 'traveler', status: 'active', last_login_at: new Date() },
      });
    } else {
      user = await prisma.users.update({
        where: { id: user.id },
        data: { firebase_uid: identity.uid, name: user.name || identity.name || undefined, last_login_at: new Date() },
      });
    }
    return { token: signToken(user), user: sanitizeUser(user) };
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

    if (body?.name != null) next.name = String(body.name);
    if (body?.email != null) {
      next.email = String(body.email).trim().toLowerCase();
      if (!next.email) throw new BadRequestException('email is required');
    }

    if (next.email && next.email !== user.email) {
      const exists = await prisma.users.findUnique({ where: { email: next.email } });
      if (exists) throw new BadRequestException('email already registered');

      const providerConflict = await prisma.providers.findFirst({
        where: {
          email: next.email,
          NOT: { user_id: user.id },
        },
      });
      if (providerConflict) {
        throw new BadRequestException('email already registered for a guide profile');
      }
    }

    const updated = await prisma.users.update({
      where: { id: user.id },
      data: next,
    });

    const ownedProvider = await prisma.providers.findFirst({
      where: {
        OR: [{ user_id: user.id }, { email: user.email }],
      },
    });

    if (ownedProvider) {
      await prisma.providers.update({
        where: { id: ownedProvider.id },
        data: {
          user_id: user.id,
          email: updated.email,
        },
      });
    }

    return sanitizeUser(updated);
  }
}
