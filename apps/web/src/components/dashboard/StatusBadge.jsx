import { Badge } from '@/components/ui/badge';

const STATUS_MAP = {
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
  completed: 'bg-slate-100 text-[#e0e0e0] border-[#2d3548]',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  succeeded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  refunded: 'bg-sky-50 text-sky-700 border-sky-200',
  processing: 'bg-sky-50 text-sky-700 border-sky-200',
};

const prettify = (status) => {
  if (!status) return 'unknown';
  return status.replace(/_/g, ' ');
};

const StatusBadge = ({ status, fallback = 'unknown' }) => {
  if (!status) {
    return <Badge variant="outline" className="bg-[#1a1f3a] text-[#a0a0a0] border-[#2d3548]">{fallback}</Badge>;
  }
  const key = status.toLowerCase();
  const className = STATUS_MAP[key] || 'bg-slate-100 text-[#e0e0e0] border-[#2d3548]';
  return (
    <Badge variant="outline" className={className}>
      {prettify(key)}
    </Badge>
  );
};

export default StatusBadge;

