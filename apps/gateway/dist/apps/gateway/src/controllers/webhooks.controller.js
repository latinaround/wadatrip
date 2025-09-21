"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksController = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
let WebhooksController = class WebhooksController {
    async stripeWebhook(req) {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const payload = req.body;
        // En dev, si no hay secret, aceptamos payload sin verificar
        let event = payload;
        if (secret && req.headers['stripe-signature']) {
            try {
                const stripe = new (require('stripe'))(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET, { apiVersion: '2024-06-20' });
                const rawBody = req.rawBody || JSON.stringify(payload);
                event = stripe.webhooks.constructEvent(rawBody, String(req.headers['stripe-signature']), secret);
            }
            catch (e) {
                return { ok: false, error: 'invalid_signature' };
            }
        }
        const type = event?.type;
        const data = event?.data?.object || {};
        const bookingId = data?.metadata?.booking_id || data?.client_reference_id || null;
        if (!bookingId)
            return { ok: true, ignored: true };
        const HUB = process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014';
        try {
            if (type === 'checkout.session.completed' || type === 'payment_intent.succeeded') {
                await axios_1.default.post(`${HUB}/bookings/${bookingId}/status`, { status: 'confirmed' });
                // TODO: actualizar payment_status a 'paid' cuando exista endpoint dedicado
            }
            else if (type === 'payment_intent.payment_failed' || type === 'charge.refunded') {
                await axios_1.default.post(`${HUB}/bookings/${bookingId}/status`, { status: 'cancelled' });
                // TODO: actualizar payment_status a 'failed'/'refunded'
            }
        }
        catch { }
        // TODO: enviar emails a user/provider (notificador dev)
        return { ok: true };
    }
};
exports.WebhooksController = WebhooksController;
__decorate([
    (0, common_1.Post)('stripe'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "stripeWebhook", null);
exports.WebhooksController = WebhooksController = __decorate([
    (0, common_1.Controller)('webhooks')
], WebhooksController);
//# sourceMappingURL=webhooks.controller.js.map