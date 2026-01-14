import { Body, Controller, Get, Patch, Post, Req, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret, getUserIdFromAuth } from '../utils/auth';

const TOKEN_TTL = process.env.JWT_TTL || '7d';

function signToken(user: any) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL },
  );
}

async function getUserFromRequest(req: any) {
  const userId = getUserIdFromAuth(req);
  if (!userId) return null;
  const prisma = getPrisma();
  return prisma.users.findUnique({ where: { id: String(userId) } });
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
    if (body?.email != null) next.email = String(body.email).toLowerCase();

    if (next.email && next.email !== user.email) {
      const exists = await prisma.users.findUnique({ where: { email: next.email } });
      if (exists) throw new BadRequestException('email already registered');
    }

    const updated = await prisma.users.update({
      where: { id: user.id },
      data: next,
    });

    return updated;
  }
}
