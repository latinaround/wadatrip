import { BadRequestException } from '@nestjs/common';

type ConnectEnvironment = Record<string, string | undefined>;

export function stripeConnectCapabilities() {
  return {
    card_payments: { requested: true as const },
    transfers: { requested: true as const },
  };
}

function connectUrl(name: 'CONNECT_RETURN_URL' | 'CONNECT_REFRESH_URL', env: ConnectEnvironment): string {
  const raw = String(env[name] || '').trim();
  if (!raw) throw new BadRequestException(`${name} is not configured`);

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException(`${name} is invalid`);
  }

  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const secure = url.protocol === 'https:' || (env.NODE_ENV !== 'production' && loopback && url.protocol === 'http:');
  if (!secure || url.username || url.password || url.hash || ['example.com', 'example.invalid'].includes(url.hostname)) {
    throw new BadRequestException(`${name} is unsafe`);
  }
  return url.toString();
}
export function stripeConnectUrls(env: ConnectEnvironment = process.env) {
  return {
    returnUrl: connectUrl('CONNECT_RETURN_URL', env),
    refreshUrl: connectUrl('CONNECT_REFRESH_URL', env),
  };
}

export function stripeConnectStatus(account: any) {
  if (!account || account.deleted) {
    return {
      linked: Boolean(account), ready: false, details_submitted: false,
      charges_enabled: false, payouts_enabled: false, requirements_due: true,
    };
  }
  const detailsSubmitted = account.details_submitted === true;
  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;
  const requirements = account.requirements || {};
  const requirementsDue = ['currently_due', 'past_due', 'pending_verification'].some(
    (key) => Array.isArray(requirements[key]) && requirements[key].length > 0,
  );
  return {
    linked: true,
    ready: detailsSubmitted && chargesEnabled && payoutsEnabled && !requirementsDue,
    details_submitted: detailsSubmitted,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    requirements_due: requirementsDue,
  };
}
