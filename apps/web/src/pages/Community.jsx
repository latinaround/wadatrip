import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import AuthDialog from '../components/AuthDialog.jsx';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog';
import DestinationCountryPicker from '../components/DestinationCountryPicker.jsx';
import DestinationCityPicker from '../components/DestinationCityPicker.jsx';
import { getCitySuggestions, normalizeCountryCode } from '../utils/geoOptions';
import { communityCopy } from '../utils/communityCopy';
import { clearCommunityMessageKey, communityMessageKey, communityRequest, destinationSearch } from '../services/community';

const button = 'rounded-xl border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50';
const input = 'w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900';

export default function Community() {
  const { token, user, loading } = useAuth();
  const location = useLocation();
  // Remount on identity changes: no old private block list, draft or response survives account changes.
  return <Workspace key={`${token || 'public'}:${user?.id || 'anonymous'}:${location.pathname}${location.search}`} token={token && user ? token : null} user={user} authLoading={loading} />;
}

function Workspace({ token, user, authLoading }) {
  const { i18n } = useTranslation(), copy = communityCopy[(i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)] || communityCopy.en;
  const [params] = useSearchParams(), { id } = useParams(), navigate = useNavigate();
  const country = normalizeCountryCode(params.get('country') || ''), city = params.get('city') || '', region = params.get('region') || '';
  const [draftCountry, setDraftCountry] = useState(country), [draftCity, setDraftCity] = useState(city), [draftRegion, setDraftRegion] = useState(region);
  const [page, setPage] = useState(1), [kind, setKind] = useState(''), [revision, setRevision] = useState(0);
  const [data, setData] = useState(null), [enabled, setEnabled] = useState(null), [busyRead, setBusyRead] = useState(true), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [authOpen, setAuthOpen] = useState(false);
  const [report, setReport] = useState(null), [reason, setReason] = useState('spam'), [blocks, setBlocks] = useState(null);
  const active = useRef(true), operation = useRef(false), readOrder = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setDraftCountry(country); setDraftCity(city); setDraftRegion(region); setPage(1); setKind(''); setData(null); }, [country, city, region, id]);
  useEffect(() => {
    const order = ++readOrder.current, controller = new AbortController();
    setError(''); setBusyRead(true);
    (async () => {
      try {
        const status = await communityRequest('/community/status', { signal: controller.signal });
        if (!active.current || order !== readOrder.current) return;
        setEnabled(status.enabled === true);
        if (status.enabled !== true || (!country && !id)) return;
        const query = new URLSearchParams({ country_code: country, city, region, page: String(page), ...(kind ? { kind } : {}) });
        const result = await communityRequest(id ? `/community/threads/${encodeURIComponent(id)}?page=${page}` : `/community/threads?${query}`, { token, signal: controller.signal });
        if (!Array.isArray(result.items) || !Number.isSafeInteger(result.total) || result.total < 0 || result.page !== page || result.limit !== 20 || (id && result.thread?.id !== id)) throw Error(copy.unavailable);
        if (active.current && order === readOrder.current) setData(result);
      } catch (err) { if (!controller.signal.aborted && active.current && order === readOrder.current) { setData(null); setError(err.message || copy.unavailable); } }
      finally { if (active.current && order === readOrder.current) setBusyRead(false); }
    })();
    return () => controller.abort();
  }, [country, city, region, id, page, kind, revision, token, copy.unavailable]);

  const destination = id ? data?.thread : { country_code: country, city, region };
  const back = `/community${destinationSearch(destination)}`;
  const countryName = destination?.country_code ? new Intl.DisplayNames([i18n.language || 'en'], { type: 'region' }).of(destination.country_code) : '';
  const destinationLabel = [destination?.city, destination?.region, countryName].filter(Boolean).join(' · ');
  async function action(path, body, after) {
    if (!active.current) return null;
    if (!token || !user) { setAuthOpen(true); return; }
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await communityRequest(path, { token, method: 'POST', body });
      if (active.current) { after?.(result); setRevision(v => v + 1); }
      return result;
    } catch (err) { if (active.current) setError(err.status && err.status < 500 ? err.message : copy.sendError); return null; }
    finally { operation.current = false; if (active.current) setBusy(false); }
  }
  const participant = Boolean(token && user && !authLoading);
  function controls(item, type) {
    if (!participant) return null;
    const own = item.author.id === user.id;
    return <div className="mt-3 flex flex-wrap gap-2 text-sm">
      {own ? <button type="button" className={button} disabled={busy} onClick={() => { if (window.confirm(copy.confirmRemove)) action(`/community/content/${type}/${item.id}/remove`, {}, () => id && type === 'thread' && navigate(back)); }}>{copy.remove}</button>
        : <><button type="button" className={button} disabled={busy} onClick={() => { setReport({ id: item.id, type }); setReason('spam'); }}>{copy.report}</button>
          <button type="button" className={button} disabled={busy} title={copy.blockHelp} onClick={() => { if (window.confirm(copy.blockHelp)) action('/community/blocks', { user_id: item.author.id }, () => id && type === 'thread' && navigate(back)); }}>{copy.block}</button></>}
      {type === 'reply' && data?.thread?.author.id === user.id && !own && !item.helpful && <button type="button" className={button} disabled={busy} onClick={() => action(`/community/content/thread/${id}/helpful`, { reply_id: item.id })}>{copy.helpful}</button>}
      {type === 'thread' && own && item.status === 'open' && item.kind === 'question' && <button type="button" className={button} disabled={busy} onClick={() => action(`/community/content/thread/${item.id}/resolve`, {})}>{copy.resolve}</button>}
    </div>;
  }
  function card(item, type) {
    return <article key={item.id} className="min-w-0 rounded-2xl border border-teal-100 bg-white p-5 shadow-sm" data-testid={`community-${type}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600"><span className="font-semibold text-slate-900">{item.author.name}</span><span>{copy[item.author.role] || copy.traveler}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(i18n.language)}</time></div>
      {type === 'thread' && <><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-teal-700">{copy[item.kind]} · {copy[item.status]}</p><h2 className="mt-2 break-words text-xl font-bold text-slate-900">{id ? item.title : <Link className="hover:underline" to={`/community/threads/${item.id}`}>{item.title}</Link>}</h2></>}
      {type === 'thread' && !id && <p className="mt-2 text-sm text-slate-600">{[item.city, item.region, item.country_code].filter(Boolean).join(' · ')}</p>}
      {item.commercial && <p className="my-2 text-sm font-medium text-amber-800">{copy.disclosure}</p>}
      {item.helpful && <p className="my-2 text-sm font-medium text-teal-800">{copy.helpfulBadge}</p>}
      <p className="mt-3 whitespace-pre-wrap break-words text-slate-700">{item.message}</p>
      {controls(item, type)}
    </article>;
  }
  async function loadBlocks() {
    try { const result = await communityRequest('/community/blocks', { token }); if (active.current) setBlocks(result.items); }
    catch (err) { if (active.current) setError(err.message); }
  }
  return <main className="page-shell" style={{ background: '#faf7f2' }}><div className="page-container mx-auto max-w-5xl space-y-6 py-8 text-slate-900">
    <header className="rounded-3xl bg-gradient-to-br from-teal-800 to-teal-600 p-6 text-white sm:p-8"><p className="text-sm font-semibold uppercase tracking-widest">Wadatrip</p><h1 className="mt-2 text-3xl font-bold">{copy.title}{destinationLabel ? ` · ${destinationLabel}` : ''}</h1><p className="mt-3 max-w-2xl">{copy.intro}</p></header>
    {!id && <form className="grid gap-4 rounded-2xl border border-teal-100 bg-white p-5 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); setPage(1); navigate(`/community${destinationSearch({ country_code: draftCountry, city: draftCity.trim(), region: draftCity.trim() ? draftRegion.trim() : '' })}`); setRevision(v => v + 1); }}>
      <div><label htmlFor="community-country" className="mb-2 block font-medium">{copy.country}</label><DestinationCountryPicker id="community-country" value={draftCountry} onChange={value => { setDraftCountry(value); setDraftCity(''); setDraftRegion(''); }} /></div>
      <div><label htmlFor="community-city" className="mb-2 block font-medium">{copy.city}</label><DestinationCityPicker id="community-city" value={draftCity} options={getCitySuggestions(draftCountry)} onChange={value => { setDraftCity(value); setDraftRegion(''); }} /></div>
      <label className="text-sm">{copy.region}<input className={`${input} mt-2`} maxLength={100} value={draftRegion} disabled={!draftCity.trim()} onChange={e => setDraftRegion(e.target.value)} /></label>
      <button className={`${button} self-end bg-teal-50`} disabled={!draftCountry}>{copy.search}</button>
    </form>}
    {destination?.country_code && <nav aria-label={copy.title} className="flex flex-wrap gap-3"><Link className={button} to={`/tours${destinationSearch(destination, 'country_code')}`}>{copy.tours}</Link>{id && <Link className={button} to={back}>{copy.back}</Link>}{!id && <span aria-current="page" className={`${button} bg-teal-50`}>{copy.title}</span>}</nav>}
    {busyRead && <p role="status">{copy.loading}</p>}
    {enabled && data && <button type="button" className={button} disabled={busy || busyRead} onClick={() => setRevision(v => v + 1)}>{copy.refresh}</button>}
    {enabled === false && <p role="status">{copy.unavailable}</p>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"><p>{error}</p><button className={`${button} mt-3`} onClick={() => setRevision(v => v + 1)}>{copy.retry}</button></div>}
    {notice && <p role="status" className="rounded-xl bg-teal-50 p-3">{notice}</p>}
    {enabled && !country && !id && <p>{copy.choose}</p>}
    {enabled && data && <>
      <p className="text-sm text-slate-600">{copy.rules}</p>
      {id ? <>{card(data.thread, 'thread')}<button className={button} onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/community/threads/${id}`); if (active.current) setNotice(copy.copied); } catch { if (active.current) setError(copy.unavailable); } }}>{copy.share}</button><h2 className="text-2xl font-bold">{copy.replyTitle}</h2></>
        : <label className="block max-w-xs text-sm">{copy.kind}<select className={`${input} mt-2`} value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}><option value="">{copy.all}</option><option value="question">{copy.question}</option><option value="tip">{copy.tip}</option></select></label>}
      <section className="space-y-4" aria-live="polite">{data.items.map(row => card(row, id ? 'reply' : 'thread'))}{!data.items.length && <p className="rounded-2xl bg-white p-5">{id ? copy.noReplies : copy.empty}</p>}</section>
      <div className="flex items-center gap-3"><button className={button} disabled={page <= 1 || busyRead} onClick={() => setPage(p => p - 1)}>{copy.prev}</button><span>{copy.page} {page}</span><button className={button} disabled={page * 20 >= data.total || busyRead} onClick={() => setPage(p => p + 1)}>{copy.next}</button></div>
      {id && data.thread.status === 'resolved' ? <p>{copy.closed}</p> : participant
        ? <Composer key={`${id || destinationSearch(destination)}`} copy={copy} reply={Boolean(id)} busy={busy || busyRead} action={action} userId={user.id} destination={destination} id={id} navigate={navigate} />
        : <button className={button} disabled={authLoading} onClick={() => setAuthOpen(true)}>{copy.signIn}</button>}
      {participant && <details onToggle={e => { if (e.currentTarget.open) loadBlocks(); }}><summary className="cursor-pointer font-semibold">{copy.blocked}</summary><p className="my-3 text-sm text-slate-600">{copy.blockHelp}</p>{blocks?.length === 0 && <p>{copy.noBlocks}</p>}{blocks?.map(row => <div key={row.id} className="my-2 flex items-center gap-3"><span>{row.name}</span><button className={button} disabled={busy} onClick={() => action('/community/blocks/remove', { user_id: row.id }, loadBlocks)}>{copy.unblock}</button></div>)}</details>}
    </>}
    <Dialog open={Boolean(report)} onOpenChange={open => { if (!open && !busy) setReport(null); }}><DialogContent className="bg-white text-slate-900"><DialogTitle>{copy.report}</DialogTitle><DialogDescription>{copy.rules}</DialogDescription><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (report) action(`/community/reports/${report.type}/${report.id}`, { reason }, () => { setReport(null); setNotice(copy.reported); }); }}><label className="block">{copy.reason}<select aria-label={copy.reason} className={`${input} mt-2`} value={reason} onChange={e => setReason(e.target.value)}>{['spam', 'harassment', 'privacy', 'other'].map(value => <option key={value} value={value}>{copy[value]}</option>)}</select></label><div className="flex gap-3"><button className={button} disabled={busy}>{copy.sendReport}</button><button type="button" className={button} disabled={busy} onClick={() => setReport(null)}>{copy.cancel}</button></div></form></DialogContent></Dialog>
    <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" initialIntent="traveler" />
  </div></main>;
}

function Composer({ copy, reply, busy, action, userId, destination, id, navigate }) {
  const [title, setTitle] = useState(''), [message, setMessage] = useState(''), [kind, setKind] = useState('question');
  const [consent, setConsent] = useState(false), [commercial, setCommercial] = useState(false), key = useRef(null);
  const [preparing, setPreparing] = useState(false), [prepareError, setPrepareError] = useState('');
  const sending = useRef(false);
  busy = busy || preparing;
  return <form className="space-y-4 rounded-2xl border border-teal-100 bg-white p-5" onSubmit={async event => {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true; setPreparing(true); setPrepareError('');
    try {
    const payload = { message: message.trim(), commercial, public_consent: consent, ...(!reply ? { country_code: destination.country_code, city: destination.city, region: destination.region, title: title.trim(), kind } : {}) };
    const client_request_id = await communityMessageKey(key, payload, `${userId}:${reply ? `reply:${id}` : `thread:${destinationSearch(destination)}`}`);
    const result = await action(reply ? `/community/threads/${id}/replies` : '/community/threads', { ...payload, client_request_id }, item => { if (!reply) navigate(`/community/threads/${item.id}`); });
    if (result) { clearCommunityMessageKey(key); setTitle(''); setMessage(''); setConsent(false); setCommercial(false); }
    } catch { setPrepareError(copy.sendError); }
    finally { sending.current = false; setPreparing(false); }
  }}><h2 className="text-xl font-bold">{reply ? copy.replyTitle : copy.ask}</h2>
    {!reply && <><label className="block">{copy.kind}<select aria-label={copy.kind} className={`${input} mt-2`} value={kind} onChange={e => setKind(e.target.value)}><option value="question">{copy.question}</option><option value="tip">{copy.tip}</option></select></label><div><label htmlFor="community-title" className="block">{copy.subject}</label><input id="community-title" className={`${input} mt-2`} value={title} onChange={e => setTitle(e.target.value)} minLength={5} maxLength={140} required disabled={busy} /></div></>}
    <div><label htmlFor="community-message" className="block">{copy.message}</label><textarea id="community-message" className={`${input} mt-2 min-h-32`} value={message} onChange={e => setMessage(e.target.value)} minLength={3} maxLength={2000} required disabled={busy} /></div>
    <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={commercial} onChange={e => setCommercial(e.target.checked)} disabled={busy} />{copy.commercial}</label>
    <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required disabled={busy} />{copy.consent}</label>
    <p className="text-sm text-slate-600">{copy.nameHelp} <Link className="underline" to="/account">{copy.account}</Link></p>
    {prepareError && <p role="alert" className="text-red-800">{prepareError}</p>}
    <button className={`${button} bg-teal-50`} disabled={busy || !consent || message.trim().length < 3 || (!reply && title.trim().length < 5)}>{busy ? copy.pending : reply ? copy.reply : copy.publish}</button>
  </form>;
}
