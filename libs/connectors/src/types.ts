export interface FlightCandidate {
  id: string;
  airline: string;
  title: string;
  departure: string;
  arrival: string;
  duration_hours: number;
  layovers: number;
  price: number;
  currency: string;
  raw?: any;
}

export interface HotelCandidate {
  id: string;
  name: string;
  stars: number;
  checkin: string;
  checkout: string;
  price_per_night: number;
  currency: string;
  nights?: number;
  raw?: any;
}

export interface ActivityCandidate {
  id: string;
  title: string;
  start: string;
  end: string;
  price: number;
  rating?: number;
  currency: string;
  raw?: any;
}
