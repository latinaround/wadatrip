import { getClaimsFromAuth } from '@wadatrip/common/security';
export { getClaimsFromAuth, getJwtSecret } from '@wadatrip/common/security';

// Parsing only; private routes must also load the active user with requireActor.
export function getUserIdFromAuth(req: any): string | null {
  return getClaimsFromAuth(req)?.sub || null;
}
