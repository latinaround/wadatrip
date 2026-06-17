export const COUNTRY_OPTIONS = [
  { code: 'PE', label: 'Peru' },
  { code: 'US', label: 'United States' },
  { code: 'MX', label: 'Mexico' },
  { code: 'CO', label: 'Colombia' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CL', label: 'Chile' },
  { code: 'EC', label: 'Ecuador' },
  { code: 'BO', label: 'Bolivia' },
  { code: 'BR', label: 'Brazil' },
  { code: 'ES', label: 'Spain' },
  { code: 'IT', label: 'Italy' },
  { code: 'FR', label: 'France' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'PT', label: 'Portugal' },
];

export const COUNTRY_NAME_TO_CODE = {
  peru: 'PE',
  'perú': 'PE',
  usa: 'US',
  us: 'US',
  'united states': 'US',
  'united states of america': 'US',
  mexico: 'MX',
  colombia: 'CO',
  argentina: 'AR',
  chile: 'CL',
  ecuador: 'EC',
  bolivia: 'BO',
  brazil: 'BR',
  brasil: 'BR',
  spain: 'ES',
  españa: 'ES',
  italy: 'IT',
  italia: 'IT',
  france: 'FR',
  francia: 'FR',
  portugal: 'PT',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
};

export const CITY_SUGGESTIONS = {
  PE: ['Lima', 'Cusco', 'Arequipa', 'Puno', 'Ica'],
  US: ['Palo Alto', 'San Francisco', 'New York', 'Los Angeles', 'Miami'],
  MX: ['Mexico City', 'Cancun', 'Oaxaca', 'Guadalajara'],
  CO: ['Bogota', 'Medellin', 'Cartagena', 'Cali'],
  AR: ['Buenos Aires', 'Mendoza', 'Bariloche'],
  CL: ['Santiago', 'Valparaiso', 'San Pedro de Atacama'],
  EC: ['Quito', 'Guayaquil', 'Cuenca'],
  BO: ['La Paz', 'Uyuni', 'Sucre'],
  BR: ['Rio de Janeiro', 'Sao Paulo', 'Salvador'],
  ES: ['Madrid', 'Barcelona', 'Seville'],
  IT: ['Rome', 'Florence', 'Venice'],
  FR: ['Paris', 'Nice', 'Lyon'],
  GB: ['London', 'Edinburgh', 'Manchester'],
  PT: ['Lisbon', 'Porto', 'Faro'],
};

export function normalizeCountryCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (upper.length === 2) return upper;
  return COUNTRY_NAME_TO_CODE[raw.toLowerCase()] || upper.slice(0, 2);
}

export function getCitySuggestions(countryCode) {
  return CITY_SUGGESTIONS[normalizeCountryCode(countryCode)] || CITY_SUGGESTIONS.PE;
}
