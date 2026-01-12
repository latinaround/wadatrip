import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import { AppModule } from './module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false, cors: true });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'] || '';

    if (contentType.startsWith('multipart/form-data')) {
      return next();
    }

    json({ limit: '10mb' })(req, res, () => {
      urlencoded({ extended: true, limit: '10mb' })(req, res, next);
    });
  });

  // Validaciones globales
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Configuraci�n Swagger
  const swagger = new DocumentBuilder()
    .setTitle('Provider Hub')
    .setDescription('Provider/Listing service for Wadatrip')
    .setVersion('0.1.0')
    .build();

  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, doc);

  // Puerto (usa 3014 por defecto)
  const port = Number(process.env.PROVIDER_HUB_PORT || process.env.PORT || 3014);
  await app.listen(port, '0.0.0.0');
  console.log(`[provider-hub] listening on :${port}`);
}

bootstrap();

