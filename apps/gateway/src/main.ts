import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    cors: {
      origin: (origin, callback) => {
        // Allow all origins in dev, reflect request origin
        callback(null, true);
      },
      credentials: true,
      methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
      allowedHeaders: ['Content-Type','Authorization','Accept'],
      exposedHeaders: ['Content-Type','Authorization'],
    },
  });

  // ✅ Parsers de body sólo para rutas NO proxied
  const server = app.getHttpAdapter().getInstance();
  const jsonParser = express.json({ limit: '5mb' });
  const urlParser = express.urlencoded({ extended: true, limit: '5mb' });

  server.use((req, res, next) => {
    // Excluir rutas que se proxyean
    if (
      req.url?.startsWith('/itineraries') ||
      req.url?.startsWith('/pricing') ||
      req.url?.startsWith('/alerts') ||
      req.url?.startsWith('/providers')
    ) {
      return next();
    }
    return jsonParser(req, res, (err: any) => {
      if (err) return next(err);
      return urlParser(req, res, next);
    });
  });

  // ✅ Validaciones globales
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ✅ Swagger
  const config = new DocumentBuilder()
    .setTitle('Wadatrip Platform API')
    .setDescription(
      'Gateway API for itineraries, pricing, alerts, collab, exports',
    )
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // ✅ Puerto específico para Gateway
  const port = Number(process.env.GATEWAY_PORT || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`[gateway] listening on :${port}`);
}
bootstrap();
