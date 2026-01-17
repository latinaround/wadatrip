import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, CreditCard, Plane, TrendingUp } from 'lucide-react';

const defaultStats = {
  totalTrips: 0,
  upcomingTrips: 0,
  pendingPayments: 0,
  totalSpentCents: 0,
  currency: 'USD',
};

const cards = [
  {
    id: 'totalTrips',
    label: 'Itinerarios guardados',
    icon: Plane,
    accent: 'bg-teal-500/10 text-teal-500',
    formatter: (value) => value,
  },
  {
    id: 'upcomingTrips',
    label: 'Viajes por venir',
    icon: CalendarClock,
    accent: 'bg-sky-500/10 text-sky-500',
    formatter: (value) => value,
  },
  {
    id: 'pendingPayments',
    label: 'Pagos pendientes',
    icon: CreditCard,
    accent: 'bg-amber-500/10 text-amber-500',
    formatter: (value) => value,
  },
  {
    id: 'totalSpentCents',
    label: 'Total invertido',
    icon: TrendingUp,
    accent: 'bg-emerald-500/10 text-emerald-500',
    formatter: (value, currency) => {
      const formatter = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      });
      return formatter.format((value || 0) / 100);
    },
  },
];

const SummaryCards = ({ stats = defaultStats }) => {
  const merged = { ...defaultStats, ...(stats || {}) };
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ id, label, icon, accent, formatter }) => {
        const IconComponent = icon;
        return (
          <Card key={id} className="border border-[#2d3548]/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#a0a0a0]">{label}</CardTitle>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${accent}`}>
                <IconComponent className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-white">
                {formatter(merged[id], merged.currency)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default SummaryCards;

