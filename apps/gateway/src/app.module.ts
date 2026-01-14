import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controllers/health.controller';
import { PaymentsController } from './controllers/payments.controller';
import { BookingsController } from './controllers/bookings.controller';
import { ProvidersController } from './controllers/providers.controller';
import { AlertsController } from './controllers/alerts.controller';
import { AuthController } from './controllers/auth.controller';

@Module({
  imports: [
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
  ],
  providers: [],
})
export class AppModule {}
