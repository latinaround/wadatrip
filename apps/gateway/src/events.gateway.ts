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

  emitItineraryUpdated(payload: any) {
    this.server.emit('itinerary.updated', payload);
  }

  emitAlertTriggered(payload: any) {
    this.server.emit('alert.triggered', payload);
  }
}

