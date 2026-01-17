import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { CalendarRange, MapPin, Plane, BedDouble, Activity } from 'lucide-react';

const currencyFormatter = (value = 0, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

const ucfirst = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);

function formatDateRange(meta) {
  if (!meta?.startDate || !meta?.days) return null;
  try {
    const start = new Date(meta.startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + (meta.days - 1));
    return `${start.toLocaleDateString()} - ${meta.days} dias (${end.toLocaleDateString()})`;
  } catch {
    return null;
  }
}

function ItemRow({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-0.5 text-[#00D9FF]"><Icon size={16} /></div>
      <div>
        <p className="font-medium text-white">{title}</p>
        {subtitle && <p className="text-[#a0a0a0] text-xs">{subtitle}</p>}
      </div>
    </div>
  );
}

const ItineraryCard = ({ scenario, itineraryId, itineraryMeta, onSelect, disableSelect }) => {
  if (!scenario) return null;
  const breakdown = scenario.price_breakdown || { flight: 0, lodging: 0, activities: 0 };
  const currency = scenario.items?.find(it => it.currency)?.currency || 'USD';
  const flight = scenario.items?.find(it => it.type === 'flight');
  const lodging = scenario.items?.find(it => it.type === 'lodging');
  const activities = scenario.items?.filter(it => it.type === 'activity') || [];
  const dateRange = formatDateRange(itineraryMeta);

  return (
    <Card className="page-card flex flex-col transition-shadow h-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge className="uppercase tracking-wide" variant="secondary">{ucfirst(scenario.type)}</Badge>
          <span className="text-2xl font-semibold text-[#00D9FF]">
            {currencyFormatter(scenario.total_price, currency)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#a0a0a0]">
          <MapPin size={16} />
          <span>
            {itineraryMeta?.origin} -> {itineraryMeta?.destination}
            {itineraryMeta?.travelers ? ` | ${itineraryMeta.travelers} viajero${itineraryMeta.travelers > 1 ? 's' : ''}` : ''}
          </span>
        </div>
        {dateRange && (
          <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
            <CalendarRange size={14} /> {dateRange}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <div className="grid grid-cols-3 gap-3 text-xs text-[#a0a0a0]">
          <div>
            <p className="font-semibold text-white">Vuelo</p>
            <p>{currencyFormatter(breakdown.flight, currency)}</p>
          </div>
          <div>
            <p className="font-semibold text-white">Hospedaje</p>
            <p>{currencyFormatter(breakdown.lodging, currency)}</p>
          </div>
          <div>
            <p className="font-semibold text-white">Actividades</p>
            <p>{currencyFormatter(breakdown.activities, currency)}</p>
          </div>
        </div>

        <div className="space-y-3">
          {flight && (
            <ItemRow
              icon={Plane}
              title={`${flight.title || 'Vuelo'} - ${flight.supplier || ''}`}
              subtitle={`${new Date(flight.start).toLocaleString()} -> ${new Date(flight.end).toLocaleString()}`}
            />
          )}

          {lodging && (
            <ItemRow
              icon={BedDouble}
              title={lodging.title || 'Alojamiento'}
              subtitle={lodging.details?.nights ? `${lodging.details.nights} noches` : undefined}
            />
          )}

          {activities.slice(0, 3).map((item) => (
            <ItemRow
              key={item.id}
              icon={Activity}
              title={item.title || 'Actividad'}
              subtitle={item.supplier || undefined}
            />
          ))}
          {activities.length > 3 && (
            <p className="text-xs text-[#a0a0a0]">+{activities.length - 3} actividades adicionales</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        <div className="w-full grid grid-cols-3 text-center text-xs text-[#a0a0a0]">
          <div>
            <p className="font-semibold text-white">Costo/dia</p>
            <p>{currencyFormatter(scenario.kpis?.cost_per_day || 0, currency)}</p>
          </div>
          <div>
            <p className="font-semibold text-white">Tiempo libre</p>
            <p>{scenario.kpis?.free_time_hours || 0} h</p>
          </div>
          <div>
            <p className="font-semibold text-white">Caminata</p>
            <p>{scenario.kpis?.walk_distance_km || 0} km</p>
          </div>
        </div>
        {onSelect && !disableSelect && (
          <Button className="w-full neon-cta font-black hover:scale-105 transition-all" onClick={() => onSelect({ scenario, itineraryId, itineraryMeta })}>
            Reservar este plan
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ItineraryCard;

