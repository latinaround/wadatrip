import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { useDayPicker } from 'react-day-picker';
import { enUS, es, fr } from 'date-fns/locale';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

// API date keys are calendar days, not instants. Never convert a clicked local
// day with toISOString(): that shifts the date in some traveler timezones.
const dateKey = day => `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
const calendarDay = key => new Date(`${key}T12:00:00`);

function AvailableDayContent({ date }) {
  const { labels, locale } = useDayPicker();
  return <><span aria-hidden="true">{date.getDate()}</span><span className="sr-only">{labels.labelDay(date, {}, { locale })}</span></>;
}

export default function TourDatePicker({ dates, value, onChange, loading, error, onRetry }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const language = i18n.resolvedLanguage?.split('-')[0] || 'en';
  const today = new Date().toISOString().slice(0, 10);
  const available = dates.filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && dateKey(calendarDay(item.date)) === item.date && item.date >= today
    && Number.isInteger(item.spots_available) && item.spots_available > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const spots = new Map(available.map(item => [item.date, item.spots_available]));
  const selected = spots.has(value) ? calendarDay(value) : undefined;
  const formatDate = day => new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(day);
  const text = selected ? formatDate(selected) : t('booking_dates.choose');

  return (
    <div className="space-y-2">
      <label htmlFor="booking-date" className="text-sm font-semibold text-[#526173]">{t('booking_dates.label')}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id="booking-date" type="button" variant="outline" disabled={loading || error || !available.length}
            aria-label={`${t('booking_dates.label')}: ${text}`}
            className="h-auto min-h-12 w-full justify-start gap-2 whitespace-normal rounded-2xl border-[#d7e6e3] bg-[#fff5ec] text-left text-[#172033]">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span>{loading ? t('booking_dates.loading') : text}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl border-[#d7e6e3] bg-white p-2 text-[#172033]">
          {available.length > 0 && <Calendar mode="single" required initialFocus showOutsideDays={false}
            components={{ DayContent: AvailableDayContent }}
            locale={{ en: enUS, es, fr }[language] || enUS}
            selected={selected} defaultMonth={selected || calendarDay(available[0].date)}
            fromMonth={calendarDay(available[0].date)} toMonth={calendarDay(available[available.length - 1].date)}
            disabled={day => !spots.has(dateKey(day))}
            modifiers={{ available: day => spots.has(dateKey(day)) }}
            modifiersClassNames={{ available: 'bg-[#e7f7f5] text-[#167c7d] font-semibold' }}
            labels={{ labelDay: day => `${formatDate(day)}${spots.has(dateKey(day)) ? ` · ${t('booking_dates.spots', { count: spots.get(dateKey(day)) })}` : ''}` }}
            onSelect={day => {
              if (!day || !spots.has(dateKey(day))) return;
              onChange(dateKey(day)); setOpen(false);
            }} />}
          <p className="px-3 pb-2 text-xs text-[#526173]">{t('booking_dates.help')}</p>
        </PopoverContent>
      </Popover>
      {selected && !loading && !error && <p role="status" className="text-xs text-[#167c7d]">{t('booking_dates.spots', { count: spots.get(value) })}</p>}
      {error ? <div role="alert" className="text-sm text-[#d15371]">
        <p>{t('booking_dates.error')}</p>
        <Button type="button" variant="outline" className="mt-2" onClick={onRetry}>{t('booking_dates.retry')}</Button>
      </div> : !loading && !available.length ? <p role="status" className="text-sm text-[#d15371]">{t('booking_dates.empty')}</p> : null}
    </div>
  );
}
