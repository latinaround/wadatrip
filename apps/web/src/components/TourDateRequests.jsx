import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { enUS, es, fr } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { dateRequestApi } from '../services/tourDateRequests';

const keyOf = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayOf = value => new Date(`${value.slice(0, 10)}T12:00:00`);

export default function TourDateRequests({ apiBase, listingId, operator = false, onSignIn, onAvailabilityChange }) {
  const { t, i18n } = useTranslation();
  const auth = useAuth(), session = useRef(auth); session.current = auth;
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [people, setPeople] = useState(1);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [offers, setOffers] = useState({});
  const [choices, setChoices] = useState({});
  const [revision, setRevision] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const context = `${auth.user?.id || ''}:${auth.token || ''}:${listingId || ''}:${operator}`;
  const contextRef = useRef(context); contextRef.current = context;
  const text = key => t(`date_requests.${key}`);
  const displayDate = value => new Intl.DateTimeFormat(i18n.resolvedLanguage || 'en', { dateStyle: 'medium' }).format(dayOf(value));
  const api = useCallback((options = {}) => dateRequestApi({ apiBase, getSession: () => session.current, ...options }), [apiBase]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/tour-date-requests/status`, { signal: controller.signal })
      .then(async response => { if (response.ok) { const data = await response.json(); if (!controller.signal.aborted) setEnabled(data.enabled === true); } })
      .catch(() => {});
    return () => controller.abort();
  }, [apiBase]);

  useEffect(() => {
    setItems([]); setError(''); setNotice(''); setOffers({}); setChoices({}); setDate(''); setBusy(false);
  }, [context]);

  useEffect(() => {
    let active = true;
    if (!enabled || auth.loading || !auth.user || !auth.token) return;
    setLoading(true);
    const params = new URLSearchParams({ scope: operator ? 'operator' : 'mine', ...(listingId ? { listing_id: listingId } : {}) });
    api({ path: `?${params}` }).then(data => { if (active) setItems(data.items || []); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, enabled, auth.loading, auth.user?.id, auth.token, listingId, operator, revision]);

  const act = async options => {
    const currentContext = context;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(options);
      if (currentContext !== contextRef.current) return;
      setNotice(text(options.path?.endsWith('/cancel') ? 'closed_notice' : operator ? 'response_notice' : 'saved'));
      setRevision(value => value + 1);
    } catch (err) {
      if (currentContext !== contextRef.current) return;
      setError(err.message);
      if (err.status === 401 || (err.status === 403 && !operator)) onSignIn?.();
    } finally { if (currentContext === contextRef.current) setBusy(false); }
  };

  const loadOffers = async item => {
    const currentContext = context;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${apiBase}/listings/${encodeURIComponent(item.listing_id)}/availability`, { signal: AbortSignal.timeout(10000) });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.items)) throw new Error(text('load_error'));
      if (currentContext !== contextRef.current) return;
      const dates = payload.items.filter(slot => slot.spots_available >= item.num_people);
      setOffers(prev => ({ ...prev, [item.id]: dates }));
      setChoices(prev => ({ ...prev, [item.id]: dates.find(slot => slot.date === item.requested_date.slice(0, 10))?.date || dates[0]?.date || '' }));
    } catch (err) { if (currentContext === contextRef.current) setError(err.message); }
    finally { if (currentContext === contextRef.current) setBusy(false); }
  };

  if (!enabled) return null;
  return <section className={operator ? 'page-card space-y-4' : 'mt-5 space-y-4 rounded-2xl border border-[#d7e6e3] bg-white p-4 text-[#172033]'} aria-label={text(operator ? 'inbox' : 'title')}>
    <h2 className="font-semibold">{text(operator ? 'inbox' : 'title')}</h2>
    <p className="text-sm">{text(operator ? 'operator_help' : 'help')}</p>
    {!operator && (!auth.user || !auth.token ? <Button type="button" disabled={auth.loading} onClick={onSignIn}>{text('sign_in')}</Button> :
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void act({ method: 'POST', body: { listing_id: listingId, date, num_people: Number(people) } }); }}>
        <label className="block text-sm" htmlFor="request-date">{text('date')}</label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild><Button id="request-date" type="button" variant="outline" disabled={busy} className="w-full">{date ? displayDate(date) : text('choose')}</Button></PopoverTrigger>
          <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] bg-white p-2 text-[#172033]">
            <Calendar mode="single" locale={{ en: enUS, es, fr }[i18n.resolvedLanguage?.split('-')[0]] || enUS}
              selected={date ? dayOf(date) : undefined} fromDate={dayOf(today)} disabled={day => keyOf(day) < today}
              onSelect={day => { if (day) { setDate(keyOf(day)); setCalendarOpen(false); } }} />
            <p className="max-w-72 p-2 text-xs">{text('calendar_help')}</p>
          </PopoverContent>
        </Popover>
        <label className="block text-sm" htmlFor="request-people">{text('people')}</label>
        <Input id="request-people" type="number" min="1" max="100" step="1" required value={people} disabled={busy} onChange={event => setPeople(event.target.value)} />
        <Button type="submit" disabled={busy || !date}>{text(busy ? 'saving' : 'submit')}</Button>
      </form>)}
    {error && <p role="alert" className="text-sm text-[#d15371]">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {auth.user && auth.token && <>
      <Button type="button" variant="outline" disabled={busy || loading} onClick={() => { setError(''); setRevision(value => value + 1); onAvailabilityChange?.(); }}>{text('refresh')}</Button>
      {loading ? <p>{text('loading')}</p> : !items.length ? <p>{text('empty')}</p> : items.map(item => <article key={item.id} className="space-y-2 rounded-xl border p-3">
        <h3 className="font-semibold">{item.listing?.title}</h3>
        <p className="text-sm">{displayDate(item.requested_date)} · {item.num_people} {text('people')}</p>
        <p className="text-sm">{text(`state_${item.status}`)}</p>
        {item.status === 'available' && item.response_date && <>
          <p>{text('offered')}: {displayDate(item.response_date)}</p>
          <p className="text-sm">{text('not_reserved')}</p>
          <Link className="underline" to={`/tours/${item.listing_id}`} onClick={() => onAvailabilityChange?.()}>{text('view')}</Link>
        </>}
        {operator && item.status === 'requested' && <>
          <Link className="block underline" to={`/operator/tours/new?edit=${item.listing_id}`}>{text('manage')}</Link>
          <Button type="button" variant="outline" disabled={busy} onClick={() => loadOffers(item)}>{text('load_dates')}</Button>
          {offers[item.id] && (offers[item.id].length ? <>
            <label className="block text-sm" htmlFor={`offer-${item.id}`}>{text('offer_date')}</label>
            <select id={`offer-${item.id}`} className="w-full rounded border bg-white p-2 text-[#172033]" value={choices[item.id]} onChange={event => setChoices(prev => ({ ...prev, [item.id]: event.target.value }))}>
              {offers[item.id].map(slot => <option key={slot.date} value={slot.date}>{displayDate(slot.date)} · {slot.spots_available} {text('spots')}</option>)}
            </select>
            <Button type="button" disabled={busy || !choices[item.id]} onClick={() => act({ path: `/${item.id}/respond`, method: 'POST', body: { status: 'available', date: choices[item.id] } })}>{text('offer')}</Button>
          </> : <p>{text('no_offer_dates')}</p>)}
          <Button type="button" variant="outline" disabled={busy} onClick={() => act({ path: `/${item.id}/respond`, method: 'POST', body: { status: 'declined' } })}>{text('decline')}</Button>
        </>}
        {!operator && ['requested', 'available'].includes(item.status) && <Button type="button" variant="outline" disabled={busy} onClick={() => act({ path: `/${item.id}/cancel`, method: 'POST' })}>{text('close')}</Button>}
      </article>)}
    </>}
  </section>;
}
