import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

@Module({})
export class ProxyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // ---------- Itineraries ----------
    consumer
      .apply(
        createProxyMiddleware({
          target: process.env.ITINERARIES_URL || 'http://127.0.0.1:3011',
          changeOrigin: true,
          proxyTimeout: 60000,
          timeout: 60000,
          logLevel: 'debug',
          onError: (err: any, req, res: any) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({
              error: 'proxy_error',
              message: err?.message,
              code: err?.code,
              target: process.env.ITINERARIES_URL || 'http://127.0.0.1:3011',
            }));
          },
        }),
      )
      .forRoutes(
        { path: 'itineraries', method: RequestMethod.ALL },
        { path: 'itineraries/*', method: RequestMethod.ALL },
      );

    // ---------- Pricing ----------
    consumer
      .apply(
        createProxyMiddleware({
          target: process.env.PRICING_URL || 'http://127.0.0.1:3012',
          changeOrigin: true,
          proxyTimeout: 60000,
          timeout: 60000,
          logLevel: 'debug',
          onProxyReq: (proxyReq, req: any) => {
            if (!req.body || !Object.keys(req.body).length) return;
            const contentType = String(proxyReq.getHeader('Content-Type') || '');
            let bodyData: any;
            if (contentType.includes('application/json')) {
              bodyData = JSON.stringify(req.body);
            }
            if (bodyData) {
              proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
              proxyReq.write(bodyData);
            }
          },
          onError: (err: any, req, res: any) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({
              error: 'proxy_error',
              message: err?.message,
              code: err?.code,
              target: process.env.PRICING_URL || 'http://127.0.0.1:3012',
            }));
          },
        }),
      )
      .forRoutes(
        { path: 'pricing', method: RequestMethod.ALL },
        { path: 'pricing/*', method: RequestMethod.ALL },
      );

    // ---------- Alerts ----------
    consumer
      .apply(
        createProxyMiddleware({
          target: process.env.ALERTS_URL || 'http://127.0.0.1:3013',
          changeOrigin: true,
          proxyTimeout: 60000,
          timeout: 60000,
          logLevel: 'debug',
          onError: (err: any, req, res: any) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({
              error: 'proxy_error',
              message: err?.message,
              code: err?.code,
              target: process.env.ALERTS_URL || 'http://127.0.0.1:3013',
            }));
          },
        }),
      )
      .forRoutes(
        { path: 'alerts', method: RequestMethod.ALL },
        { path: 'alerts/*', method: RequestMethod.ALL },
      );

    // ---------- Provider Hub ----------
    consumer
      .apply(
        createProxyMiddleware({
          target: process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014',
          changeOrigin: true,
          proxyTimeout: 60000,
          timeout: 60000,
          logLevel: 'debug',
          // Do not rewrite path; Provider Hub expects '/providers' base
          onError: (err: any, req, res: any) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({
              error: 'proxy_error',
              message: err?.message,
              code: err?.code,
              target: process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014',
            }));
          },
        }),
      )
      .forRoutes(
        { path: 'providers', method: RequestMethod.ALL },
        { path: 'providers/*', method: RequestMethod.ALL },
      );
  }
}
