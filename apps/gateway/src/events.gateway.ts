import { requireActor } from '@wadatrip/common/security';
import { getPrisma } from '@wadatrip/db';
import type { Socket } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { webPolicy } from '@wadatrip/common/web-security';
import { currentSession, resolveSession } from '@wadatrip/common/sessions';

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
      try{callback(null,!origin||origin===webPolicy().web);}catch{callback(null,false);}
    },
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  private request(client: any) {
    const token = client.handshake.auth?.token;
    const header = client.handshake.headers.authorization;
    if (token && header && header !== `Bearer ${token}`) throw Error('Ambiguous socket credentials');
    const origin=client.handshake.headers.origin;
    if(origin && (token||header))throw Error('Browser Bearer authentication is disabled');
    // Socket messages carry CSRF in handshake.auth, not an HTTP JSON body.
    return {method:'WEBSOCKET',socket:client.request?.socket||{encrypted:client.data?.webTls===true},headers: {
      ...client.handshake.headers,
      authorization: typeof token === 'string' ? `Bearer ${token}` : header,
      'x-wadatrip-web':client.handshake.auth?.web==='1'?'1':undefined,
      'x-session-version':client.handshake.auth?.sessionVersion,
      'x-csrf-token':client.handshake.auth?.csrfToken,
    }};
  }

  async handleConnection(client: Socket) {
    try {
      const origin = client.handshake.headers.origin;
      if (origin !== undefined && (typeof origin !== 'string' || origin !== webPolicy().web)) throw Error('Untrusted socket origin');
      const req = this.request(client), actor = await requireActor(req, getPrisma());
      // Set only after the shared verifier has accepted the TLS/proxy boundary.
      client.data.webTls=Boolean(client.handshake.headers.origin);
      await client.join(`user:${actor.id}`);
      const identity = currentSession(req);
      client.use(async (_packet, next) => {
        try { const active = await resolveSession(getPrisma(), this.request(client));
          if (active.user.id !== actor.id || active.session.id !== identity.id || active.session.generation !== identity.generation) throw Error('Session changed');
          next();
        } catch { next(new Error('Session unavailable')); client.disconnect(true); }
      });
      // Checks never renew idle lifetime. Bound an otherwise quiet connection too.
      const timer = setInterval(async () => {
        try { await resolveSession(getPrisma(), this.request(client), { touch: false }); }
        catch { client.disconnect(true); }
      }, 15000);
      timer.unref?.();client.once('disconnect', () => clearInterval(timer));
    } catch {
      client.disconnect(true);
    }
  }

  async emitItineraryUpdated(userId: string, payload: any) {
    await this.privateEmit(userId, 'itinerary.updated', payload);
  }

  async emitAlertTriggered(userId: string, payload: any) {
    await this.privateEmit(userId, 'alert.triggered', payload);
  }
  private async privateEmit(userId: string, event: string, payload: any) {
    try {
      for (const client of await this.server.in(`user:${userId}`).fetchSockets()) {
        try { const active = await resolveSession(getPrisma(), this.request(client), { touch: false });
          if (active.user.id !== userId) throw Error('Session changed');
          client.emit(event, payload);
        } catch { client.disconnect(true); }
      }
    } catch { /* Closed on adapter/DB failures; never emit from a stale signature. */ }
  }
}

