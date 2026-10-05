import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { Observable, catchError, from, mergeMap, throwError } from 'rxjs';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http' || process.env.ENABLE_ADMIN_CONSOLE !== 'true') return next.handle();
    const req = context.switchToHttp().getRequest();
    const log = async (result: string) => {
      // New console reads and MFA writes already commit their audit atomically.
      if (!req.adminAuditActorId || String(req.route?.path || '').startsWith('/admin/')) return;
      const route = String(req.route?.path || 'unknown').slice(0, 150);
      const id = String(req.params?.id || req.params?.bookingId || '');
      try { await getPrisma().admin_audit_log.create({ data: { actor_id: req.adminAuditActorId,
        action: `${req.method} ${route}`, resource_id: /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : null, result } }); }
      catch { console.error(JSON.stringify({ operation: 'admin_audit', result: 'failed', category: 'audit_write_failed' })); }
    };
    return next.handle().pipe(mergeMap(async value => { await log('success'); return value; }),
      catchError(error => from(log('rejected')).pipe(mergeMap(() => throwError(() => error)))));
  }
}
