import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OperatorLeadsGuard } from './security.guard';
import { HealthController } from './controllers/health.controller';
import { OperatorLeadsController } from './controllers/operator-leads.controller';
import { OutscraperService } from './services/outscraper.service';
import { OperatorLeadsService } from './services/operator-leads.service';

@Module({
  controllers: [HealthController, OperatorLeadsController],
  providers: [OutscraperService, OperatorLeadsService, { provide: APP_GUARD, useClass: OperatorLeadsGuard }],
})
export class AppModule {}
