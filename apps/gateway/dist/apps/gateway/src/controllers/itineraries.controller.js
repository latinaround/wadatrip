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
exports.ItinerariesController = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const events_gateway_1 = require("../events.gateway");
const ITINERARIES_URL = process.env.ITINERARIES_URL || 'http://localhost:3011';
let ItinerariesController = class ItinerariesController {
    events;
    constructor(events) {
        this.events = events;
    }
    async generate(body, providerFlights, providerHotels, providerActivities) {
        const { data } = await axios_1.default.post(`${ITINERARIES_URL}/itineraries/generate`, body, { params: { providerFlights, providerHotels, providerActivities } });
        return data;
    }
    async update(body, providerFlights, providerHotels, providerActivities) {
        const { data } = await axios_1.default.post(`${ITINERARIES_URL}/itineraries/update`, body, { params: { providerFlights, providerHotels, providerActivities } });
        this.events.emitItineraryUpdated({
            itinerary_id: body.itinerary_id,
            new_version_id: data.version_id,
            diff: data.diff,
            ts: new Date().toISOString(),
        });
        return data;
    }
};
exports.ItinerariesController = ItinerariesController;
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('providerFlights')),
    __param(2, (0, common_1.Query)('providerHotels')),
    __param(3, (0, common_1.Query)('providerActivities')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ItinerariesController.prototype, "generate", null);
__decorate([
    (0, common_1.Post)('update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('providerFlights')),
    __param(2, (0, common_1.Query)('providerHotels')),
    __param(3, (0, common_1.Query)('providerActivities')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ItinerariesController.prototype, "update", null);
exports.ItinerariesController = ItinerariesController = __decorate([
    (0, common_1.Controller)('itineraries'),
    __metadata("design:paramtypes", [events_gateway_1.EventsGateway])
], ItinerariesController);
//# sourceMappingURL=itineraries.controller.js.map