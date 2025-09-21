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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';
function ensureEnabled() { if (!ENABLED)
    throw new common_1.NotFoundException(); }
// Minimal Stripe wrapper (optional at runtime)
function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
    if (!key)
        return null;
    try {
        return new (require('stripe'))(key, { apiVersion: '2024-06-20' });
    }
    catch {
        return null;
    }
}
let PaymentsController = class PaymentsController {
    async connectLink(providerId) {
        ensureEnabled();
        const stripe = getStripe();
        // Fetch provider to get/set stripe_account_id
        const HUB = process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014';
        const { data: provider } = await axios_1.default.get(`${HUB}/providers/${providerId}`);
        if (!stripe) {
            // Fallback mock link in dev
            return { url: `https://connect.stripe.com/express_onboarding/${providerId}` };
        }
        let accountId = provider.stripe_account_id;
        if (!accountId) {
            const acct = await stripe.accounts.create({ type: 'express', email: provider.email, country: provider.country_code || 'US' });
            accountId = acct.id;
            // store on provider via a verify-like path (or add a dedicated endpoint in hub)
            await axios_1.default.post(`${HUB}/providers/${providerId}/verify`, { status: provider.status, documents: [], stripe_account_id: accountId }).catch(() => { });
        }
        const link = await stripe.accountLinks.create({ account: accountId, refresh_url: process.env.CONNECT_REFRESH_URL || 'https://example.com/reauth', return_url: process.env.CONNECT_RETURN_URL || 'https://example.com/return', type: 'account_onboarding' });
        return { url: link.url };
    }
    async createIntent(body) {
        const amount = Math.trunc(Number(body?.amount || 0));
        if (!amount || amount < 1) {
            throw new common_1.BadRequestException('amount must be greater than 0');
        }
        const currency = (body?.currency || 'usd').toLowerCase();
        const description = body?.description;
        const stripe = getStripe();
        const amountCents = Math.max(50, amount);
        if (!stripe) {
            return { clientSecret: `pi_mock_${Date.now()}`, mock: true, amount: amountCents, currency };
        }
        const intent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency,
            description,
            automatic_payment_methods: { enabled: true },
        });
        return { clientSecret: intent.client_secret };
    }
    async checkout(bookingId, body) {
        ensureEnabled();
        const stripe = getStripe();
        const HUB = process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014';
        const { data: booking } = await axios_1.default.get(`${HUB}/bookings/${bookingId}`);
        const { data: provider } = await axios_1.default.get(`${HUB}/providers/${booking.provider_id}`);
        const amountCents = Math.max(50, Math.round(Number(booking.total_price || 0) * 100));
        const feePct = Number(process.env.WADATRIP_FEE_PCT || 15);
        const feeCents = Math.floor((amountCents * feePct) / 100);
        if (!stripe || !provider?.stripe_account_id) {
            // Fallback dev response
            return { url: `https://checkout.stripe.com/pay/cs_test_${bookingId}` };
        }
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            success_url: process.env.CHECKOUT_SUCCESS_URL || 'https://example.com/success',
            cancel_url: process.env.CHECKOUT_CANCEL_URL || 'https://example.com/cancel',
            line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: amountCents, product_data: { name: booking?.listing?.title || 'Tour booking' } } }],
            payment_intent_data: {
                application_fee_amount: feeCents,
                transfer_data: { destination: provider.stripe_account_id },
            },
        });
        return { url: session.url };
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)('connect/:providerId/link'),
    __param(0, (0, common_1.Param)('providerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "connectLink", null);
__decorate([
    (0, common_1.Post)('create-intent'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "createIntent", null);
__decorate([
    (0, common_1.Post)('bookings/:id/checkout'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "checkout", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.Controller)('payments')
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map