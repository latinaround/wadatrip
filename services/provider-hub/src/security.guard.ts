import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { requireInternalToken, requireAdmin, requireProviderAccess } from '@wadatrip/common/security';
import { HealthController } from './controllers/health.controller';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (context.getClass() === HealthController) return true;
    requireInternalToken(context.switchToHttp().getRequest());
    return true;
  }
}

// Guards run before Multer, so unauthorized callers cannot write or buffer documents.
@Injectable()
export class ProviderUploadGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (req.params.id) await requireProviderAccess(req, getPrisma(), req.params.id);
    else await requireAdmin(req, getPrisma());
    // Private identity documents require separately reviewed storage/retention and
    // verification. Reject before Multer writes to disk or buffers the upload.
    if (process.env.ENABLE_OPERATOR_DOCUMENT_UPLOADS !== 'true') {
      throw new ServiceUnavailableException('Operator document submission is not enabled. Contact Wadatrip for verification.');
    }
    return true;
  }
}
