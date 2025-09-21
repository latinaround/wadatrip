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
exports.ProvidersController = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const HUB = process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014';
const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';
function ensureEnabled() {
    if (!ENABLED)
        throw new common_1.NotFoundException();
}
let ProvidersController = class ProvidersController {
    async listProviders(q) {
        ensureEnabled();
        const { data } = await axios_1.default.get(`${HUB}/providers`, { params: q });
        return data;
    }
    async createProvider(body) {
        ensureEnabled();
        const { data } = await axios_1.default.post(`${HUB}/providers`, body);
        return data;
    }
    async getProvider(id) {
        ensureEnabled();
        const { data } = await axios_1.default.get(`${HUB}/providers/${id}`);
        return data;
    }
    async verifyProvider(id, body) {
        ensureEnabled();
        const { data } = await axios_1.default.post(`${HUB}/providers/${id}/verify`, body);
        return data;
    }
    async createListing(body) {
        ensureEnabled();
        const { data } = await axios_1.default.post(`${HUB}/listings`, body);
        return data;
    }
    async searchListings(q) {
        ensureEnabled();
        const { data } = await axios_1.default.get(`${HUB}/listings/search`, { params: q });
        return data;
    }
    async setListingStatus(id, body) {
        ensureEnabled();
        const { data } = await axios_1.default.patch(`${HUB}/listings/${id}/status`, body);
        return data;
    }
};
exports.ProvidersController = ProvidersController;
__decorate([
    (0, common_1.Get)('providers'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "listProviders", null);
__decorate([
    (0, common_1.Post)('providers'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "createProvider", null);
__decorate([
    (0, common_1.Get)('providers/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "getProvider", null);
__decorate([
    (0, common_1.Post)('providers/:id/verify'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "verifyProvider", null);
__decorate([
    (0, common_1.Post)('listings'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "createListing", null);
__decorate([
    (0, common_1.Get)('listings/search'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "searchListings", null);
__decorate([
    (0, common_1.Post)('listings/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProvidersController.prototype, "setListingStatus", null);
exports.ProvidersController = ProvidersController = __decorate([
    (0, common_1.Controller)()
], ProvidersController);
//# sourceMappingURL=providers.controller.js.map