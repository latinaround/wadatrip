import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentController } from './agent/agent.controller';
import { AlertsController } from './controllers/alerts.controller';
import { AuthController } from './controllers/auth.controller';
import { BookingsController } from './controllers/bookings.controller';
import { HealthController } from './controllers/health.controller';
import { ItinerariesController } from './controllers/itineraries.controller';
import { ListingsController } from './controllers/listings.controller';
import { PaymentsController } from './controllers/payments.controller';
import { ProvidersController } from './controllers/providers.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { WadaAgentController } from './controllers/wadagent.controller';
import { EventsGateway } from './events.gateway';
import { AuthService } from './services/auth.service';
import { JwtAuthGuard } from './auth/jwt.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'], // ✅ busca el .env local y en la raíz del monorepo
    }),
  ],
  controllers: [
    AgentController,
    AlertsController,
    ItinerariesController,
    ProvidersController,
    ListingsController,
    BookingsController,
    PaymentsController,
    WebhooksController,
    HealthController,
    AuthController,
    WadaAgentController,
  ],
  providers: [EventsGateway, AuthService, JwtAuthGuard, RolesGuard],
})
export class AppModule {}
