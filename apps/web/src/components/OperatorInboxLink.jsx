import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOperatorInbox } from '../context/OperatorInboxContext.jsx';

export function OperatorInboxCounts() {
  const { data } = useOperatorInbox();
  const { t } = useTranslation();
  if (!data?.is_operator) return null;
  const groups = data.groups || {};
  return <span className="inline-flex min-w-0 max-w-full flex-wrap gap-2" aria-live="polite">
    {groups.reservations?.total > 0 ? <span className="rounded-full bg-[#16d7d0] px-2 text-[#050816]">{t('operator_inbox.new_count', { count: groups.reservations.total })}</span> : null}
    {groups.sandbox?.total > 0 ? <span className="rounded-full border border-amber-400/40 px-2 text-amber-200">{t('operator_inbox.test_count', { count: groups.sandbox.total })}</span> : null}
    {groups.unverified?.total > 0 ? <span className="rounded-full border border-amber-400/40 px-2 text-amber-200">{t('operator_inbox.unverified_count', { count: groups.unverified.total })}</span> : null}
  </span>;
}

export default function OperatorInboxLink({ className = '', onClick }) {
  const { data } = useOperatorInbox();
  const { t } = useTranslation();
  if (!data?.is_operator) return null;
  return <Link to="/operator/tours/new?panel=operations" onClick={onClick}
    className={`inline-flex flex-wrap items-center gap-2 rounded-xl border border-[#16d7d0]/30 px-3 py-2 text-sm text-[#16d7d0] ${className}`}>
    {t('account_context.dashboard')} <OperatorInboxCounts />
  </Link>;
}
