import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swagger = new DocumentBuilder()
    .setTitle('Operator Leads')
    .setDescription('Lead acquisition service for tour operators and local guides')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.OPERATOR_LEADS_PORT || process.env.PORT || 3023);
  await app.listen(port, '0.0.0.0');
  console.log(`[operator-leads] listening on :${port}`);
}

bootstrap();
