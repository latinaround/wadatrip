// apps/gateway/src/app.module.ts
import { Module } from '@nestjs/common';

import { HealthController } from './controllers/health.controller';
import { AlertsController } from './controllers/alerts.controller';
import { ProvidersController } from './controllers/providers.controller';
import { ListingsController } from './controllers/listings.controller';
import { BookingsController } from './controllers/bookings.controller';

@Module({
  controllers: [
    HealthController,
    AlertsController,     // ?? ahora incluido
    ProvidersController,
    ListingsController,
    BookingsController,
  ],
})
export class AppModule {}
