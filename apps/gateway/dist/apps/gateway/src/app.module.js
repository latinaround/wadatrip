"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const pricing_controller_1 = require("./controllers/pricing.controller");
const alerts_controller_1 = require("./controllers/alerts.controller");
const events_gateway_1 = require("./events.gateway");
const providers_controller_1 = require("./controllers/providers.controller");
const bookings_controller_1 = require("./controllers/bookings.controller");
const health_controller_1 = require("./controllers/health.controller");
const proxy_module_1 = require("./proxy.module");
const payments_controller_1 = require("./controllers/payments.controller");
const webhooks_controller_1 = require("./controllers/webhooks.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [proxy_module_1.ProxyModule],
        controllers: [pricing_controller_1.PricingController, alerts_controller_1.AlertsController, providers_controller_1.ProvidersController, bookings_controller_1.BookingsController, payments_controller_1.PaymentsController, webhooks_controller_1.WebhooksController, health_controller_1.HealthController],
        providers: [events_gateway_1.EventsGateway],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map