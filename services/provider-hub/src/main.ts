import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Validaciones globales
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Configuración Swagger
  const swagger = new DocumentBuilder()
    .setTitle('Provider Hub')
    .setDescription('Provider/Listing service for Wadatrip')
    .setVersion('0.1.0')
    .build();

  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, doc);

  // Puerto (usa 3014 por defecto)
  const port = Number(process.env.PORT || 3014);
  await app.listen(port, '0.0.0.0');
  console.log(`[provider-hub] listening on :${port}`);
}

bootstrap();
