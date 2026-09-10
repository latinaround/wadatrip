import { requireActor } from '@wadatrip/common/security';
import { getPrisma } from '@wadatrip/db';
import type { Socket } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:19006',
    ],
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const authorization = typeof token === 'string' ? `Bearer ${token}` : client.handshake.headers.authorization;
      const actor = await requireActor({ headers: { authorization } }, getPrisma());
      await client.join(`user:${actor.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitItineraryUpdated(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('itinerary.updated', payload);
  }

  emitAlertTriggered(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('alert.triggered', payload);
  }
}

