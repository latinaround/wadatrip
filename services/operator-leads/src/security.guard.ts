import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { requireAdmin, requireInternalToken } from '@wadatrip/common/security';
import { HealthController } from './controllers/health.controller';

@Injectable()
export class OperatorLeadsGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    if (context.getClass() === HealthController) return true;
    const req = context.switchToHttp().getRequest();
    context.switchToHttp().getResponse().setHeader('Cache-Control', 'no-store');
    requireInternalToken(req);
    await requireAdmin(req, getPrisma());
    if (process.env.ENABLE_OPERATOR_LEADS !== 'true') throw new ServiceUnavailableException('Operator leads is not enabled');
    if (req.method === 'POST' && process.env.ENABLE_OPERATOR_LEAD_SEARCH !== 'true') throw new ServiceUnavailableException('Operator acquisition search is not enabled');
    return true;
  }
}
