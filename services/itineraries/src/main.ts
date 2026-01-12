import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.ITINERARIES_PORT || process.env.PORT || 3011);
  await app.listen(port, '0.0.0.0');
  console.log(`[svc-itineraries] listening on :${port}`);
}
bootstrap();
