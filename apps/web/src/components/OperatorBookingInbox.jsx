import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOperatorInbox } from '../context/OperatorInboxContext.jsx';
import { formatBookingDeparture } from '../utils/accountDisplay.js';
import { Button } from './ui/button';

export default function OperatorBookingInbox() {
  const { data, error, refresh, review } = useOperatorInbox();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(null);
  const [failed, setFailed] = useState(false);
  const mark = async id => {
    setBusy(id); setFailed(false);
    try { await review(id); } catch { setFailed(true); } finally { setBusy(null); }
  };
  return <section className="page-card" aria-label={t('operator_inbox.title')}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-white">{t('operator_inbox.title')}</h2>
      <Button type="button" variant="outline" onClick={refresh}>{t('operator_inbox.refresh')}</Button>
    </div>
    <p className="mt-3 text-sm text-[#a0a0a0]">{t('operator_inbox.help')}</p>
    {error || failed ? <p role="alert" className="mt-3 text-amber-200">{t('operator_inbox.error')}</p> : null}
    {!data && !error ? <p role="status">{t('operator_inbox.loading')}</p> : null}
    {data?.is_operator ? ['reservations', 'sandbox', 'unverified'].map(group => {
      const batch = data.groups?.[group];
      return <div key={group} className="mt-5 space-y-3">
        <h3 className={`font-semibold ${group === 'reservations' ? 'text-white' : 'text-amber-200'}`}>
          {t(`operator_inbox.${group}`)} · {batch?.total || 0}
        </h3>
        {group !== 'reservations' ? <p className="text-sm text-[#a0a0a0]">{t(`operator_inbox.${group}_help`)}</p> : null}
        {!batch?.total ? <p className="text-sm text-[#a0a0a0]">{t('operator_inbox.empty')}</p> : null}
        {(batch?.items || []).map(item => <article key={item.id} className="rounded-xl border border-[#16d7d0]/30 p-4">
          <h4 className="font-semibold text-white">{item.title}</h4>
          <p>{formatBookingDeparture({ date: item.date, departureAt: item.departure_at, timezone: item.timezone })}</p>
          <p>{t('operator_inbox.travelers', { count: item.travelers })}</p>
          <p className="break-all text-sm text-[#a0a0a0]">{t('operator_inbox.reference')}: {item.id}</p>
          <Button className="mt-3" type="button" disabled={busy !== null} onClick={() => mark(item.id)}>
            {busy === item.id ? t('operator_inbox.saving') : t('operator_inbox.review')}
          </Button>
        </article>)}
        {batch?.total > (batch?.items?.length || 0) ? <p className="text-sm text-[#a0a0a0]">{t('operator_inbox.more')}</p> : null}
      </div>;
    }) : null}
  </section>;
}
