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
exports.AlertsController = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const events_gateway_1 = require("../events.gateway");
const ALERTS_URL = process.env.ALERTS_URL || 'http://localhost:3013';
let AlertsController = class AlertsController {
    events;
    constructor(events) {
        this.events = events;
    }
    async subscribe(body) {
        const { data } = await axios_1.default.post(`${ALERTS_URL}/alerts/subscribe`, body);
        return data;
    }
    async notify(body) {
        const { data } = await axios_1.default.post(`${ALERTS_URL}/alerts/notify`, body);
        this.events.emitAlertTriggered({
            alert_id: data?.alert_id || null,
            type: body?.type || 'generic',
            payload: body,
            ts: new Date().toISOString(),
        });
        return data;
    }
    // Backward-compatible list endpoints
    async list(itinerary_id, user_id) {
        const { data } = await axios_1.default.get(`${ALERTS_URL}/alerts/list`, { params: { itinerary_id, user_id } });
        return data;
    }
    async listRoot(itinerary_id, user_id) {
        const { data } = await axios_1.default.get(`${ALERTS_URL}/alerts/list`, { params: { itinerary_id, user_id } });
        return data;
    }
    async testFire(body) {
        const { data } = await axios_1.default.post(`${ALERTS_URL}/alerts/test-fire`, body);
        if (data?.ok) {
            this.events.emitAlertTriggered({ alert_id: data.alert_id || null, type: body?.type || 'test', payload: body, ts: new Date().toISOString() });
        }
        return data;
    }
};
exports.AlertsController = AlertsController;
__decorate([
    (0, common_1.Post)('subscribe'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AlertsController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Post)('notify'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AlertsController.prototype, "notify", null);
__decorate([
    (0, common_1.Get)('list'),
    __param(0, (0, common_1.Query)('itinerary_id')),
    __param(1, (0, common_1.Query)('user_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AlertsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('itinerary_id')),
    __param(1, (0, common_1.Query)('user_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AlertsController.prototype, "listRoot", null);
__decorate([
    (0, common_1.Post)('test-fire'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AlertsController.prototype, "testFire", null);
exports.AlertsController = AlertsController = __decorate([
    (0, common_1.Controller)('alerts'),
    __metadata("design:paramtypes", [events_gateway_1.EventsGateway])
], AlertsController);
//# sourceMappingURL=alerts.controller.js.map