import { BadRequestException, Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { getUserIdFromAuth } from '../utils/auth';

@Controller('devices')
export class DevicesController {
  @Post('push-token')
  async registerPushToken(@Req() req: any, @Body() body: any) {
    const userId = getUserIdFromAuth(req);
    if (!userId) throw new UnauthorizedException('not authenticated');
    const token = String(body?.token || '').trim();
    if (!/^ExponentPushToken\[[^\]]+\]$/.test(token) && !/^ExpoPushToken\[[^\]]+\]$/.test(token)) {
      throw new BadRequestException('a valid Expo push token is required');
    }
    const platform = body?.platform ? String(body.platform).slice(0, 20) : null;
    const prisma = getPrisma();
    const device = await prisma.push_devices.upsert({
      where: { token },
      create: { user_id: String(userId), token, platform, provider: 'expo' },
      update: { user_id: String(userId), platform, provider: 'expo' },
    });
    return { ok: true, id: device.id };
  }
}