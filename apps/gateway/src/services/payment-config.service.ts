import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { PaymentMode } from '@wadatrip/common/payment-lifecycle';

export function stripePaymentMode(env: NodeJS.ProcessEnv = process.env): PaymentMode {
  if (env.STRIPE_SECRET_KEY && env.STRIPE_SECRET && env.STRIPE_SECRET_KEY !== env.STRIPE_SECRET) {
    throw new ServiceUnavailableException('Conflicting payment credentials');
  }
  const key = env.STRIPE_SECRET_KEY || env.STRIPE_SECRET || '';
  const match = /^(?:sk|rk)_(test|live)_[A-Za-z0-9_]+$/.exec(key);
  if (!match) throw new ServiceUnavailableException('Payment credentials have an unknown mode');
  return match[1] as PaymentMode;
}

export function requireNewPaymentAccess(providerId: string, env: NodeJS.ProcessEnv = process.env) {
  const mode = stripePaymentMode(env);
  if (env.PAYMENTS_ACCEPT_NEW === 'false') throw new ServiceUnavailableException('Online payments are temporarily unavailable');
  if (mode === 'live') {
    const providers = String(env.PAYMENTS_LIVE_PROVIDER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    if (env.PAYMENTS_LIVE_ENABLED !== 'true' || env.PAYMENTS_ACCEPT_NEW !== 'true' || !providers.includes(providerId)) {
      throw new ServiceUnavailableException('Real payments have not been enabled for this operator');
    }
    if (!String(env.WADATRIP_FEE_PCT || '').trim()) throw new ServiceUnavailableException('Live marketplace fee must be explicitly configured');
    // Validate configuration before any Checkout or Connect processor operation.
    marketplaceFee(0, env);
  }
  return mode;
}

export function assertStripeObjectMode(object: any, mode = stripePaymentMode()) {
  if (object?.livemode !== (mode === 'live')) throw new ConflictException('External payment mode mismatch');
}

export function payoutAccountForMode(provider: any, mode: PaymentMode) {
  // Preserve the original field as a legacy Test-only reference; never promote it to Live.
  return mode === 'live' ? provider?.stripe_live_account_id : (provider?.stripe_test_account_id || provider?.stripe_account_id);
}

export function marketplaceFee(amountCents: number, env: NodeJS.ProcessEnv = process.env) {
  const pct = Number(env.WADATRIP_FEE_PCT || 15);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new BadRequestException('Invalid payment fee configuration');
  return Math.floor(amountCents * pct / 100);
}
