import { Module } from '@nestjs/common';
import { PricingController } from './controllers/pricing.controller';
import { AlertsController } from './controllers/alerts.controller';
import { EventsGateway } from './events.gateway';
import { ProvidersController } from './controllers/providers.controller';
import { BookingsController } from './controllers/bookings.controller';
import { HealthController } from './controllers/health.controller';
import { ProxyModule } from './proxy.module';
import { PaymentsController } from './controllers/payments.controller';
import { WebhooksController } from './controllers/webhooks.controller';

@Module({
  imports: [ProxyModule],
  controllers: [PricingController, AlertsController, ProvidersController, BookingsController, PaymentsController, WebhooksController, HealthController],
  providers: [EventsGateway],
})
export class AppModule {}
