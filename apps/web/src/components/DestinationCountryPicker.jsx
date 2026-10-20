import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown } from 'lucide-react';
import { getCountryOptions } from '../utils/geoOptions';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './ui/command';

const normalizeSearch = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const searchNames = new Map();
for (const language of ['en', 'es', 'fr']) {
  for (const country of getCountryOptions(language)) {
    searchNames.set(country.code, `${searchNames.get(country.code) || ''} ${country.label}`);
  }
}

export default function DestinationCountryPicker({ id, value, onChange }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const options = useMemo(() => getCountryOptions(i18n.resolvedLanguage || 'en'), [i18n.resolvedLanguage]);
  const selected = options.find(country => country.code === value);
  const matches = options.filter(country => normalizeSearch(`${searchNames.get(country.code)} ${country.code}`).includes(normalizeSearch(search)));
  const choose = code => { onChange(code); setOpen(false); setSearch(''); };
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(''); }}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-haspopup="listbox"
          variant="outline" className="h-[50px] w-full justify-between rounded-2xl border-[#d7e6e3] bg-[#fff5ec] px-4 font-normal text-[#172033]">
          <span className="truncate">{selected ? `${selected.label} (${selected.code})` : t('marketplace.all_countries')}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 max-w-[calc(100vw-2rem)] border-[#d7e6e3] bg-white p-0 text-[#172033]">
        <Command shouldFilter={false} className="bg-white text-[#172033]">
          <CommandInput aria-label={t('marketplace.search_countries')} placeholder={t('marketplace.search_countries')} value={search} onValueChange={setSearch} />
          <CommandList id={`${id}-options`}>
            <CommandEmpty>{t('marketplace.no_country_match')}</CommandEmpty>
            {!search && <CommandItem value="all" onSelect={() => choose('')}>{t('marketplace.all_countries')}</CommandItem>}
            {matches.map(country => (
              <CommandItem key={country.code} value={country.code} onSelect={() => choose(country.code)} className="data-[selected=true]:bg-[#e7f7f5] data-[selected=true]:text-[#172033]">
                {country.label} ({country.code})
                {value === country.code && <Check className="ml-auto h-4 w-4" aria-hidden="true" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
