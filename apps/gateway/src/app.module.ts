import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertsController } from './controllers/alerts.controller';
import { BookingsController } from './controllers/bookings.controller';
import { HealthController } from './controllers/health.controller';
import { ItinerariesController } from './controllers/itineraries.controller';
import { PaymentsController } from './controllers/payments.controller';
import { ProvidersController } from './controllers/providers.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'], // ✅ busca el .env local y en la raíz del monorepo
    }),
  ],
  controllers: [
    AlertsController,
    ItinerariesController,
    ProvidersController,
    BookingsController,
    PaymentsController,
    WebhooksController,
    HealthController,
  ],
  providers: [EventsGateway],
})
export class AppModule {}
