import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import { EventEmitter } from 'events';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import cors from 'cors';
import { createWriteStream, existsSync, mkdirSync, WriteStream } from 'fs';
import { join } from 'path';
import type { ClientRequest, IncomingMessage } from 'http';
import type { Request, Response, NextFunction } from 'express';

/**
 * ✅ Tipos extendidos para evitar errores en los hooks del proxy
 */
interface ProxyOptionsPatched extends Options<Request, Response> {
  onProxyReq?: (proxyReq: ClientRequest, req: Request, res: Response) => void;
  onProxyRes?: (proxyRes: IncomingMessage, req: Request, res: Response) => void;
  onError?: (err: any, req: Request, res: Response) => void;
}

/**
 * ✅ Logger personalizado: escribe en consola y logs/gateway.log
 */
class GatewayLogger extends ConsoleLogger {
  constructor(private readonly stream: WriteStream) {
    super('GatewayLogger', { timestamp: true });

  }

  private write(level: string, message: any, context?: string, trace?: string) {
    const timestamp = new Date().toISOString();
    const contextLabel = context ? ` [${context}]` : '';
    let line = `${timestamp} ${level}${contextLabel} ${message}`;
    if (trace) line += `\n${trace}`;
    this.stream.write(`${line}\n`);
  }

  log(message: any, context?: string) {
    super.log(message, context);
    this.write('LOG', message, context);
  }

  warn(message: any, context?: string) {
    super.warn(message, context);
    this.write('WARN', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    super.error(message, trace, context);
    this.write('ERROR', message, context, trace);
  }

  debug(message: any, context?: string) {
    super.debug(message, context);
    this.write('DEBUG', message, context);
  }

  verbose(message: any, context?: string) {
    super.verbose(message, context);
    this.write('VERBOSE', message, context);
  }
}

EventEmitter.defaultMaxListeners = 20;

async function bootstrap() {
  // 📁 Configurar carpeta de logs
  const logsDir = join(process.cwd(), 'logs');
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  const logStream = createWriteStream(join(logsDir, 'gateway.log'), { flags: 'a' });
  const logger = new GatewayLogger(logStream);

  const allowedOriginPatterns = [
    'https://wadatrip.com',
    'https://www.wadatrip.com',
    /\.vercel\.app$/i,
  ];
  const isAllowedOrigin = (origin?: string) =>
    !!origin && allowedOriginPatterns.some((pattern) => (
      typeof pattern === 'string' ? origin === pattern : pattern.test(origin)
    ));
  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  // 🚀 Crear instancia Nest
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger,
  });

  app.enableCors(corsOptions);

  app.useLogger(logger);
  const server = app.getHttpAdapter().getInstance();
  server.options('*', cors(corsOptions));
  server.options(['/auth/login', '/auth/register', '/providers', '/listings'], cors(corsOptions));

  // Fast health response without touching other modules.
  server.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  const nestHandledPrefixes = ['/docs'];
  // 🚫 Excluir rutas internas del Gateway (como /wadagent)
  server.use(nestHandledPrefixes, (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    logger.log(`[Gateway] Direct route handled by Nest: ${req.originalUrl}`, 'Bypass');
    next();
  });


  // ✅ Middleware adicional para CORS manual
  server.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});


  /**
   * ✅ Función central para registrar un proxy con prefijo completo
   */
  const attachProxy = (path: string, target: string, label: string) => {
    const normalizedTarget = target.replace(/\/$/, '');

    const sendPreflight = (req: Request, res: Response) => {
      const origin = req.headers.origin ?? '*';
      const requestedHeaders = req.headers['access-control-request-headers'] ?? 'Content-Type, Authorization';
      const requestedMethod = req.headers['access-control-request-method'] ?? 'GET,POST,PUT,PATCH,DELETE,OPTIONS';

      if (origin && isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      res.setHeader('Access-Control-Allow-Headers', requestedHeaders);
      res.setHeader('Access-Control-Allow-Methods', requestedMethod);
      res.status(204).end();
    };

    const options: ProxyOptionsPatched = {
      target: normalizedTarget,
      changeOrigin: true,
      xfwd: true,
      proxyTimeout: 60000,
      timeout: 60000,
      selfHandleResponse: false,
      router: (req) => normalizedTarget,
      pathRewrite: {},

      onProxyReq: (proxyReq, req, _res) => {
        const destination = `${normalizedTarget}${req.originalUrl}`;
        logger.log(`[Gateway Proxy] ${label}: ${req.method} ${req.originalUrl} -> ${destination}`, 'Proxy');

        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },

      onProxyRes: (proxyRes, req, res) => {
        const originHeader = req.headers.origin;
        if (originHeader && isAllowedOrigin(originHeader)) {
          proxyRes.headers['access-control-allow-origin'] = originHeader;
          proxyRes.headers['access-control-allow-credentials'] = 'true';
          res.setHeader('Access-Control-Allow-Origin', originHeader);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          const existingVary = res.getHeader('Vary');
          if (existingVary) {
            res.setHeader('Vary', `${existingVary}, Origin`);
          } else {
            res.setHeader('Vary', 'Origin');
          }
        }
        logger.log(`[Gateway Proxy] ${label}: ${req.method} ${req.originalUrl} <- ${proxyRes.statusCode}`, 'Proxy');
      },

      onError: (err, req, res) => {
        logger.error(`[Gateway Proxy] ${label}: ${err?.message || err}`, undefined, 'Proxy');
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        res.end(
          JSON.stringify({
            error: 'proxy_error',
            target: label,
            message: err?.message || 'unknown error',
          }),
        );
      },
    };

    // 🚀 Mantiene el prefijo (/pricing/predict) al reenviar al microservicio
    server.options(path, sendPreflight);
    server.options(`${path}/*`, sendPreflight);

    const proxy = createProxyMiddleware<Request, Response>(options);
    server.use(path, (req: any, res: any, next: any) => {
      req.url = req.originalUrl;
      return proxy(req, res, next);
    });
  };
  // 🧩 Check ENV variables
  console.log('🌍 ENV CHECK (from main.ts)');
  console.log('FF_PROVIDER_HUB =', process.env.FF_PROVIDER_HUB);
  console.log('PROVIDER_HUB_URL =', process.env.PROVIDER_HUB_URL);

  // ?? Registrar proxies solo para servicios inactivos cuando se habiliten
  const enableAlertsProxy = (process.env.ENABLE_ALERTS_PROXY || 'false').toLowerCase() === 'true';
  const enableProviderHubProxy = (process.env.ENABLE_PROVIDER_HUB_PROXY || 'false').toLowerCase() === 'true';
  const enableWadagentProxy = (process.env.ENABLE_WADAGENT_PROXY || 'false').toLowerCase() === 'true';
  const proxyPrefixes: string[] = [];

  if (enableAlertsProxy) {
    attachProxy('/alerts', process.env.ALERTS_URL || 'http://localhost:3013', 'alerts');
    proxyPrefixes.push('/alerts');
  }

  if (enableProviderHubProxy) {
    attachProxy('/providers', process.env.PROVIDER_HUB_URL || 'http://localhost:3014', 'provider-hub');
    proxyPrefixes.push('/providers');
  }

  if (enableWadagentProxy) {
    attachProxy('/wadagent', process.env.WADAGENT_URL || 'http://localhost:3022', 'wadagent');
    proxyPrefixes.push('/wadagent');
  }


  // ⚡ Webhook Stripe sin parseo JSON
  server.use('/webhooks/stripe', express.raw({ type: '*/*' }));

  // ✅ Body parser para rutas no-proxied
  const jsonParser = express.json({ limit: '5mb' });
  const urlParser = express.urlencoded({ extended: true, limit: '5mb' });
  server.use((req: any, res: any, next: any) => {
    if (proxyPrefixes.some((prefix) => req.url?.startsWith(prefix))) {
      return next();
    }
    return jsonParser(req, res, (err: any) => {
      if (err) return next(err);
      return urlParser(req, res, next);
    });
  });

  // 🚦 Validación global
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 📘 Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Wadatrip Platform API')
    .setDescription('Gateway API for itineraries, pricing, alerts, and providers')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // 🟢 Iniciar servidor
  // 🟢 Iniciar servidor
const port = Number(process.env.GATEWAY_PORT ?? process.env.PORT ?? 3015);
await app.listen(port, '0.0.0.0');

// 🚫 Desactivar todos los timeouts HTTP (evita 504)
const httpServer = app.getHttpServer();
if (httpServer && httpServer.keepAliveTimeout !== undefined) {
  httpServer.keepAliveTimeout = 0;
  httpServer.headersTimeout = 0;
  httpServer.requestTimeout = 0;
  console.log('🕒 HTTP timeouts disabled (infinite timeout mode)');
}

logger.log(`[gateway] listening on :${port}`, 'Bootstrap');
const proxyLabel = proxyPrefixes.length ? proxyPrefixes.join(', ') : '(none)';
logger.log('✅ Proxy routes loaded successfully: ' + proxyLabel, 'Bootstrap');

}

bootstrap();



