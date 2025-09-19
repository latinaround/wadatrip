import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Post, Body, ValidationPipe, Get } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { predictPricing } from '@wadatrip/pricing/adred.mock';

@Controller('pricing')
class PricingController {
  @Post('predict')
  async predict(@Body() body: any) {
    // 🔑 Normalizamos claves para evitar UNKNOWN-ROUTE
    const normalized = {
      ...body,
      origin: body.origin ?? body.Origin,
      destination: body.destination ?? body.Destination,
      start_date: body.start_date ?? body.start_Date ?? body.Start_date,
    };

    // Helpers para mapear al DTO del Gateway
    const parseRoute = (routeStr?: string) => {
      if (!routeStr || typeof routeStr !== 'string' || !routeStr.includes('-')) return { origin: undefined, destination: undefined };
      const [o, d] = routeStr.split('-');
      return { origin: o, destination: d };
    };

    const daysBetween = (fromISO?: string) => {
      if (!fromISO) return 14;
      const from = new Date(fromISO);
      if (isNaN(+from)) return 14;
      const diffMs = from.getTime() - Date.now();
      return Math.max(0, Math.round(diffMs / (24 * 3600 * 1000)));
    };

    const toDto = (input: any, out: any) => {
      const { origin: oFromRoute, destination: dFromRoute } = parseRoute(out?.route || input?.route);
      const origin = input?.origin || oFromRoute || '';
      const destination = input?.destination || dFromRoute || '';
      const date = input?.start_date || '';
      return {
        origin,
        destination,
        date,
        current_price: out.current_price,
        predicted_low: out.predicted_low,
        trend: out.trend,
        action: out.action,
        confidence: out.confidence,
        horizon_days: daysBetween(date),
        next_check_at: out.next_check_at,
      };
    };

    // Si viene `{ routes: [...] }`, calculamos múltiples predicciones
    if (Array.isArray(body?.routes) && body.routes.length > 0) {
      const predictions = body.routes.map((r: any) => {
        const inNorm = {
          route: r?.route ?? r?.Route,
          origin: r?.origin ?? r?.Origin,
          destination: r?.destination ?? r?.Destination,
          start_date: r?.start_date ?? r?.date ?? r?.start_Date ?? r?.Start_date,
          current_price: r?.current_price,
        };
        const out = predictPricing(inNorm);
        return toDto(inNorm, out);
      });
      return { predictions };
    }

    const out = predictPricing(normalized);
    return { predictions: [toDto(normalized, out)] };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [PricingController],
})
class AppModule {}

async function bootstrap() {
  // 🚀 Desactivamos el bodyParser global para evitar "request aborted"
  const app = await NestFactory.create(AppModule, {
    cors: true,
    // Re-enable JSON body parsing so @Body() contains the posted payload
  });

  // ✅ Validaciones globales
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ✅ Configuración Swagger
  const swagger = new DocumentBuilder()
    .setTitle('Pricing Service')
    .setDescription('Dynamic pricing predictions for Wadatrip')
    .setVersion('0.1.0')
    .build();

  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, doc);

  // ✅ Puerto específico para Pricing
  const port = Number(process.env.PRICING_PORT || 3012);
  await app.listen(port, '0.0.0.0');
  console.log(`[svc-pricing] listening on :${port}`);
}

bootstrap();
