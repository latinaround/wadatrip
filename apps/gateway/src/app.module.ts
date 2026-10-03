import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controllers/health.controller';
import { PaymentsController } from './controllers/payments.controller';
import { BookingsController } from './controllers/bookings.controller';
import { ProvidersController } from './controllers/providers.controller';
import { AlertsController } from './controllers/alerts.controller';
import { AuthController } from './controllers/auth.controller';
import { DestinationCoversController } from './controllers/destination-covers.controller';
import { PricingController } from './controllers/pricing.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { EventsGateway } from './events.gateway';
import { TripsController } from './controllers/trips.controller';
import { DevicesController } from './controllers/devices.controller';
import { BookingAutomationService } from './services/booking-automation.service';
import { TourDateRequestsController } from './controllers/tour-date-requests.controller';
import { TourRequestNotificationsService } from './services/tour-request-notifications.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'], // ? busca el .env local y en la raiz del monorepo
    }),
  ],
  controllers: [
    HealthController,
    PaymentsController,
    BookingsController,
    ProvidersController,
    AlertsController,
    AuthController,
    DestinationCoversController,
    PricingController,
    WebhooksController,
    TripsController,
    DevicesController,
    TourDateRequestsController,
  ],
  providers: [EventsGateway, BookingAutomationService, TourRequestNotificationsService],
})
export class AppModule {}
