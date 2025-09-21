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
exports.BookingsController = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const HUB = process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014';
const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';
function ensureEnabled() { if (!ENABLED)
    throw new common_1.NotFoundException(); }
let BookingsController = class BookingsController {
    async list(q) {
        ensureEnabled();
        const { data } = await axios_1.default.get(`${HUB}/bookings`, { params: q });
        return data;
    }
    async get(id) {
        ensureEnabled();
        const { data } = await axios_1.default.get(`${HUB}/bookings/${id}`);
        return data;
    }
    async create(body) {
        ensureEnabled();
        const { data } = await axios_1.default.post(`${HUB}/bookings`, body);
        return data;
    }
    async status(id, body) {
        ensureEnabled();
        const { data } = await axios_1.default.post(`${HUB}/bookings/${id}/status`, body);
        return data;
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Get)('bookings'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('bookings/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('bookings'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('bookings/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BookingsController.prototype, "status", null);
exports.BookingsController = BookingsController = __decorate([
    (0, common_1.Controller)()
], BookingsController);
//# sourceMappingURL=bookings.controller.js.map