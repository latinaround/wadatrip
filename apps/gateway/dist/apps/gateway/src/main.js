"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const express = __importStar(require("express"));
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bodyParser: false,
        cors: {
            origin: (origin, callback) => {
                // Allow all origins in dev, reflect request origin
                callback(null, true);
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
            exposedHeaders: ['Content-Type', 'Authorization'],
        },
    });
    // ✅ Parsers de body sólo para rutas NO proxied
    const server = app.getHttpAdapter().getInstance();
    const jsonParser = express.json({ limit: '5mb' });
    const urlParser = express.urlencoded({ extended: true, limit: '5mb' });
    server.use((req, res, next) => {
        // Excluir rutas que se proxyean
        if (req.url?.startsWith('/itineraries') ||
            req.url?.startsWith('/pricing') ||
            req.url?.startsWith('/alerts') ||
            req.url?.startsWith('/providers')) {
            return next();
        }
        return jsonParser(req, res, (err) => {
            if (err)
                return next(err);
            return urlParser(req, res, next);
        });
    });
    // ✅ Validaciones globales
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    // ✅ Swagger
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Wadatrip Platform API')
        .setDescription('Gateway API for itineraries, pricing, alerts, collab, exports')
        .setVersion('1.0.0')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('docs', app, document);
    // ✅ Puerto específico para Gateway
    const port = Number(process.env.GATEWAY_PORT || 3000);
    await app.listen(port, '0.0.0.0');
    console.log(`[gateway] listening on :${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map