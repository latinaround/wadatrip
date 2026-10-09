import { BadRequestException } from '@nestjs/common';

type ConnectEnvironment = Record<string, string | undefined>;

export function stripeConnectCapabilities() {
  return {
    transfers: { requested: true as const },
  };
}

export function stripeConnectServiceAgreement() {
  return { service_agreement: 'recipient' as const };
}

export function stripeConnectAccountUpdate(account: any) {
  const agreement = String(account?.tos_acceptance?.service_agreement || '').toLowerCase();
  if (agreement && agreement !== 'recipient') {
    throw new BadRequestException('Existing payout account uses an incompatible service agreement');
  }

  const transferStatus = String(account?.capabilities?.transfers || '').toLowerCase();
  const transferRequested = ['active', 'inactive', 'pending'].includes(transferStatus);
  if (agreement === 'recipient') {
    return transferRequested ? null : { capabilities: stripeConnectCapabilities() };
  }

  return {
    capabilities: stripeConnectCapabilities(),
    tos_acceptance: stripeConnectServiceAgreement(),
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
      charges_enabled: false, transfers_enabled: false, payouts_enabled: false, requirements_due: true,
    };
  }
  const detailsSubmitted = account.details_submitted === true;
  const chargesEnabled = account.charges_enabled === true;
  const transfersEnabled = account.capabilities?.transfers === 'active';
  const payoutsEnabled = account.payouts_enabled === true;
  const requirements = account.requirements || {};
  const requirementsDue = ['currently_due', 'past_due', 'pending_verification'].some(
    (key) => Array.isArray(requirements[key]) && requirements[key].length > 0,
  );
  return {
    linked: true,
    ready: detailsSubmitted && transfersEnabled && payoutsEnabled && !requirementsDue,
    details_submitted: detailsSubmitted,
    charges_enabled: chargesEnabled,
    transfers_enabled: transfersEnabled,
    payouts_enabled: payoutsEnabled,
    requirements_due: requirementsDue,
  };
}
