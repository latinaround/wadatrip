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
    @Query('providerFlights') providerFlights?: string,
    @Query('providerHotels') providerHotels?: string,
    @Query('providerActivities') providerActivities?: string,
  ): Promise<GenerateItineraryResponse> {
    const params: Record<string, string> = {};
    if (providerFlights) params.providerFlights = providerFlights;
    if (providerHotels) params.providerHotels = providerHotels;
    if (providerActivities) params.providerActivities = providerActivities;
    const config = Object.keys(params).length ? { params } : undefined;
    const { data } = await axios.post(`${ITINERARIES_URL}/itineraries/generate`, body, config);
    return data;
  }

  @Post('update')
  async update(
    @Body() body: UpdateItineraryRequest,
    @Query('providerFlights') providerFlights?: string,
    @Query('providerHotels') providerHotels?: string,
    @Query('providerActivities') providerActivities?: string,
  ): Promise<UpdateItineraryResponse> {
    const params: Record<string, string> = {};
    if (providerFlights) params.providerFlights = providerFlights;
    if (providerHotels) params.providerHotels = providerHotels;
    if (providerActivities) params.providerActivities = providerActivities;
    const config = Object.keys(params).length ? { params } : undefined;
    const { data } = await axios.post(`${ITINERARIES_URL}/itineraries/update`, body, config);
    this.events.emitItineraryUpdated({
      itinerary_id: body.itinerary_id,
      new_version_id: data.version_id,
      diff: data.diff,
      ts: new Date().toISOString(),
    });
    return data;
  }
}
