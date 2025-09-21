"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyModule = void 0;
const common_1 = require("@nestjs/common");
const http_proxy_middleware_1 = require("http-proxy-middleware");
let ProxyModule = class ProxyModule {
    configure(consumer) {
        // ---------- Itineraries ----------
        consumer
            .apply((0, http_proxy_middleware_1.createProxyMiddleware)({
            target: process.env.ITINERARIES_URL || 'http://127.0.0.1:3011',
            changeOrigin: true,
            proxyTimeout: 60000,
            timeout: 60000,
            logger: console,
            onError: (err, req, res) => {
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
        }))
            .forRoutes({ path: 'itineraries', method: common_1.RequestMethod.ALL }, { path: 'itineraries/*', method: common_1.RequestMethod.ALL });
        // ---------- Pricing ----------
        consumer
            .apply((0, http_proxy_middleware_1.createProxyMiddleware)({
            target: process.env.PRICING_URL || 'http://127.0.0.1:3012',
            changeOrigin: true,
            proxyTimeout: 60000,
            timeout: 60000,
            logger: console,
            onProxyReq: (proxyReq, req) => {
                if (!req.body || !Object.keys(req.body).length)
                    return;
                const contentType = String(proxyReq.getHeader('Content-Type') || '');
                let bodyData;
                if (contentType.includes('application/json')) {
                    bodyData = JSON.stringify(req.body);
                }
                if (bodyData) {
                    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                    proxyReq.write(bodyData);
                }
            },
            onError: (err, req, res) => {
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
        }))
            .forRoutes({ path: 'pricing', method: common_1.RequestMethod.ALL }, { path: 'pricing/*', method: common_1.RequestMethod.ALL });
        // ---------- Alerts ----------
        consumer
            .apply((0, http_proxy_middleware_1.createProxyMiddleware)({
            target: process.env.ALERTS_URL || 'http://127.0.0.1:3013',
            changeOrigin: true,
            proxyTimeout: 60000,
            timeout: 60000,
            logger: console,
            onError: (err, req, res) => {
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
        }))
            .forRoutes({ path: 'alerts', method: common_1.RequestMethod.ALL }, { path: 'alerts/*', method: common_1.RequestMethod.ALL });
        // ---------- Provider Hub ----------
        consumer
            .apply((0, http_proxy_middleware_1.createProxyMiddleware)({
            target: process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014',
            changeOrigin: true,
            proxyTimeout: 60000,
            timeout: 60000,
            logger: console,
            onError: (err, req, res) => {
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
        }))
            .forRoutes({ path: 'providers', method: common_1.RequestMethod.ALL }, { path: 'providers/*', method: common_1.RequestMethod.ALL });
    }
};
exports.ProxyModule = ProxyModule;
exports.ProxyModule = ProxyModule = __decorate([
    (0, common_1.Module)({})
], ProxyModule);
//# sourceMappingURL=proxy.module.js.map