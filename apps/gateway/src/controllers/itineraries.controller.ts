import { Body, Controller, Post, Query } from '@nestjs/common';
import axios from 'axios';
import { GenerateItineraryRequest, GenerateItineraryResponse, UpdateItineraryRequest, UpdateItineraryResponse } from '@wadatrip/common/dtos';
import { EventsGateway } from '../events.gateway';

const ITINERARIES_URL = process.env.ITINERARIES_URL || 'http://localhost:3011';

@Controller('itineraries')
export class ItinerariesController {
  constructor(private readonly events: EventsGateway) {}
  @Post('generate')
  async generate(
    @Body() body: GenerateItineraryRequest,
    @Query('providerFlights') providerFlights?: 'amadeus'|'mock',
    @Query('providerHotels') providerHotels?: 'travelpayouts'|'mock',
    @Query('providerActivities') providerActivities?: 'viator'|'mock',
  ): Promise<GenerateItineraryResponse> {
    const { data } = await axios.post(`${ITINERARIES_URL}/itineraries/generate`, body, { params: { providerFlights, providerHotels, providerActivities } });
    return data;
  }

  @Post('update')
  async update(
    @Body() body: UpdateItineraryRequest,
    @Query('providerFlights') providerFlights?: 'amadeus'|'mock',
    @Query('providerHotels') providerHotels?: 'travelpayouts'|'mock',
    @Query('providerActivities') providerActivities?: 'viator'|'mock',
  ): Promise<UpdateItineraryResponse> {
    const { data } = await axios.post(`${ITINERARIES_URL}/itineraries/update`, body, { params: { providerFlights, providerHotels, providerActivities } });
    this.events.emitItineraryUpdated({
      itinerary_id: body.itinerary_id,
      new_version_id: data.version_id,
      diff: data.diff,
      ts: new Date().toISOString(),
    });
    return data;
  }
}
