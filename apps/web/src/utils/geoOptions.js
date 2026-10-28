// ISO 3166-1 officially assigned countries/territories, checked 2026-10-19:
// https://github.com/unicode-org/cldr/blob/main/tools/cldr-code/src/main/resources/org/unicode/cldr/util/data/external/iso_3166_status.txt
// Static codes: discovering a destination never depends on inventory or a remote lookup.
const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ
VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/);
const countryCodeSet = new Set(COUNTRY_CODES);
const normalizeName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function getCountryOptions(language = 'en') {
  const names = new Intl.DisplayNames([language], { type: 'region' });
  return COUNTRY_CODES.map(code => ({ code, label: names.of(code) }))
    .sort((left, right) => left.label.localeCompare(right.label, language));
}

// Retain the same shape for account and operator forms.
export const COUNTRY_OPTIONS = getCountryOptions('en');

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

const countryNames = new Map(Object.entries(COUNTRY_NAME_TO_CODE).map(([name, code]) => [normalizeName(name), code]));
for (const language of ['en', 'es', 'fr']) {
  for (const { label, code } of getCountryOptions(language)) countryNames.set(normalizeName(label), code);
}

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
  if (countryCodeSet.has(upper)) return upper;
  return countryNames.get(normalizeName(raw)) || '';
}

export function getCitySuggestions(countryCode) {
  return CITY_SUGGESTIONS[normalizeCountryCode(countryCode)] || [];
}
