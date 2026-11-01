import { BadRequestException, ConflictException, ForbiddenException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { performance } from 'perf_hooks';
import { isIP } from 'net';
import { getPrisma } from '@wadatrip/db';
import { requireAdmin } from '@wadatrip/common/security';
import { adminSessionHash } from '@wadatrip/common/admin-proof';
import { currentSession } from '@wadatrip/common/sessions';
import { requireWebRequest } from '@wadatrip/common/web-security';
import { authRequestPeer } from './auth-rate-limit.service';

const MAX_AUTH_MS = 600000, MAX_WINDOW_MS = 300000, MAX_SAMPLES = 6;
const labels = ['baseline', 'prefix-a', 'prefix-b'];
type Identity = { id: string; session: string };
type Timer = { cancel: () => void };
type Input = { env: NodeJS.ProcessEnv; authorize: (req: any) => Promise<Identity>;
  peer: (req: any) => string; now?: () => number; mono?: () => number;
  random?: (size: number) => Buffer; schedule?: (fn: () => void, ms: number) => Timer };
type Window = { key: Buffer; owner: Buffer; until: number; monoUntil: number;
  timer: Timer; samples: Map<string, { depth: number; peer: Buffer }> };
const denied = () => new ForbiddenException('Proxy diagnostic access denied');
const unavailable = () => new ServiceUnavailableException('Proxy diagnostic is unavailable');

// Test dependencies are code-only; requests cannot configure policy or clocks.
export function createProxyDiagnostic(input: Input) {
  const now = input.now || Date.now, mono = input.mono || (() => performance.now());
  const random = input.random || randomBytes;
  const schedule = input.schedule || ((fn: () => void, ms: number) => {
    const timer = setTimeout(fn, ms); timer.unref(); return { cancel: () => clearTimeout(timer) };
  });
  const born = now(), monoBorn = mono();
  const expiry = String(input.env.AUTH_PROXY_DIAGNOSTICS_EXPIRES_AT || ''), until = Date.parse(expiry);
  const adminId = String(input.env.AUTH_PROXY_DIAGNOSTICS_ADMIN_ID || '');
  const hops = Number(input.env.AUTH_TRUSTED_PROXY_HOPS);
  const configured = input.env.AUTH_PROXY_DIAGNOSTICS === 'true' && input.env.ENABLE_ADMIN_CONSOLE === 'true'
    && /^[A-Za-z0-9_-]{1,128}$/.test(adminId) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiry)
    && Number.isFinite(until) && until > born && until - born <= MAX_AUTH_MS
    && Number.isInteger(hops) && hops >= 1 && hops <= 4;
  const monoDeadline = monoBorn + (until - born);
  let expired = !configured, used = false, state: Window | null = null;
  function wipe() {
    const current = state; state = null;
    if (!current) return;
    current.timer.cancel(); current.key.fill(0); current.owner.fill(0);
    for (const row of current.samples.values()) row.peer.fill(0);
    current.samples.clear();
  }
  function expire() { expired = true; wipe(); }
  const outerTimer = configured ? schedule(expire, until - born) : null;
  function live() {
    if (expired || !configured) return false;
    const wall = now(), tick = mono();
    if (!Number.isFinite(wall) || !Number.isFinite(tick) || wall < born || tick < monoBorn || wall >= until || tick >= monoDeadline) { expire(); return false; }
    if (state && (wall >= state.until || tick >= state.monoUntil)) wipe();
    return true;
  }
  const digest = (key: Buffer, purpose: string, value: string) => createHmac('sha256', key).update(JSON.stringify([purpose, value])).digest();
  function owner(current: Window, identity: Identity) {
    const candidate = digest(current.key, 'owner-v1', JSON.stringify([identity.id, identity.session]));
    try { return timingSafeEqual(current.owner, candidate); } finally { candidate.fill(0); }
  }
  async function authorized(req: any) {
    // No GET/health hook, native Bearer, internal delegation, or query controls.
    if (req?.method !== 'POST' || req?.url !== '/admin/mfa/verify') throw denied();
    let identity: Identity;
    try { identity = await input.authorize(req); }
    catch (error) {
      if (error instanceof HttpException && [400, 401, 403, 409].includes(error.getStatus())) throw error;
      throw unavailable(); // No raw adapter details in responses or exception logs.
    }
    if (!configured || identity.id !== adminId) throw denied();
    if (!live()) throw unavailable();
    return identity;
  }
  function summary(current: Window) {
    const group = (client: string) => {
      const rows = labels.map(label => current.samples.get(client + ':' + label));
      return { captured: rows.filter(Boolean).length, depths: rows.map(row => row?.depth ?? null),
        depths_match: rows.every(Boolean) ? rows.every((row, i) => row!.depth === hops + i) : null,
        prefix_invariant: rows.every(Boolean) ? rows.every(row => timingSafeEqual(row!.peer, rows[0]!.peer)) : null };
    };
    const a = group('a'), b = group('b');
    const baseA = current.samples.get('a:baseline'), baseB = current.samples.get('b:baseline');
    const distinct = baseA && baseB ? !timingSafeEqual(baseA.peer, baseB.peer) : null;
    const complete = current.samples.size === MAX_SAMPLES;
    const pass = complete && a.depths_match && b.depths_match && a.prefix_invariant && b.prefix_invariant && distinct;
    return { active: true, expires_at: new Date(current.until).toISOString(), captured: current.samples.size,
      max_samples: MAX_SAMPLES, clients: { a, b }, distinct_clients: distinct,
      assessment: complete ? (pass ? 'pass' : 'fail') : 'incomplete' };
  }
  return {
    async control(req: any, command: any) {
      const identity = await authorized(req);
      const sample = command?.action === 'sample';
      if (!command || typeof command !== 'object' || Array.isArray(command)
        || !['start', 'read', 'stop', 'sample'].includes(command.action)
        || Object.keys(command).sort().join(',') !== (sample ? 'action,client,label' : 'action')
        || (sample && (!['a', 'b'].includes(command.client) || !labels.includes(command.label)))) {
        throw new BadRequestException('Invalid diagnostic action');
      }
      if (command.action === 'start') {
        if (used || state) throw new ConflictException('Diagnostic authorization has already been used');
        const wall = now(), tick = mono();
        if (!live() || wall >= until || tick >= monoDeadline) throw unavailable();
        const key = random(32);
        if (!Buffer.isBuffer(key) || key.length !== 32) throw unavailable();
        const current: Window = { key, owner: digest(key, 'owner-v1', JSON.stringify([identity.id, identity.session])),
          until: Math.min(until, wall + MAX_WINDOW_MS), monoUntil: Math.min(monoDeadline, tick + MAX_WINDOW_MS),
          timer: { cancel: () => {} }, samples: new Map() };
        state = current; used = true;
        current.timer = schedule(() => { if (state === current) wipe(); }, Math.max(0, Math.min(current.until - now(), current.monoUntil - mono())));
        return { active: true, expires_at: new Date(current.until).toISOString(), max_samples: MAX_SAMPLES };
      }
      if (!state) {
        if (command.action === 'stop') { used = true; return { active: false }; }
        throw unavailable();
      }
      if (!owner(state, identity)) throw denied();
      if (command.action === 'stop') { wipe(); return { active: false }; }
      if (!sample) return summary(state);
      const current = state, slot = command.client + ':' + command.label;
      if (current.samples.has(slot) || current.samples.size >= MAX_SAMPLES) return { accepted: false };
      const chain = req?.headers?.['x-forwarded-for'];
      if (typeof chain !== 'string' || chain.length > 1024) throw unavailable();
      let peer: string;
      try { peer = input.peer(req); } catch { throw unavailable(); }
      if (!isIP(peer)) throw unavailable();
      // No await between slot check and write: completions cannot spend a slot twice.
      current.samples.set(slot, { depth: chain.split(',').filter(Boolean).length, peer: digest(current.key, 'peer-v1', peer) });
      return { accepted: true };
    },
    dispose() { expire(); outerTimer?.cancel(); },
  };
}

const diagnostic = createProxyDiagnostic({ env: process.env, peer: authRequestPeer, authorize: async req => {
  if (process.env.ENABLE_ADMIN_CONSOLE !== 'true') throw unavailable();
  requireWebRequest(req, true); // exact origin/host, HTTPS, cookie-only, JSON
  const actor = await requireAdmin(req, getPrisma()); // DB session + CSRF + current MFA
  if (currentSession(req).kind !== 'web') throw denied();
  return { id: actor.id, session: adminSessionHash(req) }; // ID + generation + epoch
} });
export const controlProxyDiagnostic = (req: any, command: any) => diagnostic.control(req, command);
