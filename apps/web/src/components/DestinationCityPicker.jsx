import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './ui/command';

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function DestinationCityPicker({ id, value, onChange, options = [], placeholder }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const matches = options.filter(city => normalize(city).includes(normalize(search)));
  const choose = city => { onChange(city); setOpen(false); setSearch(''); };
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(''); }}>
      <div className="flex w-full items-center gap-1 rounded-2xl border border-[#d7e6e3] bg-[#fff5ec] focus-within:ring-2 focus-within:ring-[#169a99]/30">
        <Input id={id} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}
          autoComplete="off" className="h-[50px] min-w-0 flex-1 rounded-2xl !border-0 !bg-transparent px-4 !text-[#172033] shadow-none focus-visible:ring-0" />
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" aria-label={t('marketplace.choose_city')} aria-expanded={open}
            className="mr-1 h-11 w-11 shrink-0 text-[#167c7d]">
            <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] border-[#d7e6e3] bg-white p-0 text-[#172033]">
        <Command shouldFilter={false} className="bg-white text-[#172033]">
          <CommandInput aria-label={t('marketplace.search_cities')} placeholder={t('marketplace.search_cities')} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{t('marketplace.no_city_suggestions')}</CommandEmpty>
            {matches.map(city => <CommandItem key={city} value={`city:${city}`} onSelect={() => choose(city)}
              className="data-[selected=true]:bg-[#e7f7f5] data-[selected=true]:text-[#172033]">{city}</CommandItem>)}
            {search.trim() && !matches.length ? <CommandItem value="manual-city" onSelect={() => choose(search.trim())}
              className="data-[selected=true]:bg-[#e7f7f5] data-[selected=true]:text-[#172033]">{t('marketplace.search_city_value', { city: search.trim() })}</CommandItem> : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
