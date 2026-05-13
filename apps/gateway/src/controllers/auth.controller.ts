import { Body, Controller, Get, Patch, Post, Req, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret, getUserIdFromAuth } from '../utils/auth';

const TOKEN_TTL_SECONDS = Number(process.env.JWT_TTL_SECONDS) || 60 * 60 * 24 * 7;

function signToken(user: any) {
  const secret = getJwtSecret() as jwt.Secret;
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: TOKEN_TTL_SECONDS },
  );
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
        role: body?.role ? String(body.role) : 'traveler',
        status: 'active',
      },
    });

    const token = signToken(user);
    return { token, user };
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
    return { token, user };
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
          role: body?.role ? String(body.role) : 'traveler',
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
    return { token, user };
  }

  @Get('me')
  async me(@Req() req: any) {
    const user = await getUserFromRequest(req);
    if (!user) throw new UnauthorizedException('not authenticated');
    return user;
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

    return updated;
  }
}
