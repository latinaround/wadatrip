// services/service-provider-hub/src/module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProvidersController } from './controllers/providers.controller';
import { ListingsController } from './controllers/listings.controller';
import { BookingsController } from './controllers/bookings.controller';
import { AlertsController } from './controllers/alerts.controller';
import { HealthController } from './controllers/health.controller';
import { IdentityVerificationService } from './services/identity-verification.service';
import { IdentityVerificationQueueService, IDENTITY_VERIFICATION_QUEUE } from './services/identity-verification-queue.service';
import { IdentityVerificationProcessor } from './queues/identity-verification.processor';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    BullModule.registerQueue({
      name: IDENTITY_VERIFICATION_QUEUE,
    }),
  ],
  controllers: [
    HealthController,
    ProvidersController,
    ListingsController,
    BookingsController,
    AlertsController,
  ],
  providers: [
    IdentityVerificationService,
    IdentityVerificationQueueService,
    IdentityVerificationProcessor,
  ],
})
export class AppModule {}
