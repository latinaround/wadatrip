import { financialAudit } from './financial-audit';
// Only normalized, explicitly selected technical/financial fields belong in this inbox.
export async function receivePaymentEvent(prisma: any, id: string, type: string, payload: any) {
  await prisma.paymentEvent.upsert({ where: { id }, create: { id, type, payload, status: 'received' }, update: {} });
  const current = await prisma.paymentEvent.findUnique({ where: { id } });
  if (current.processed_at) return false;
  await prisma.paymentEvent.updateMany({ where: { id, processed_at: null }, data: {
    status: 'processing', attempts: { increment: 1 }, last_attempt_at: new Date(), error_category: null,
  } });
  financialAudit({ event_id: id, operation: type, processor: 'stripe', result: 'processing' });
  return true;
}

export async function failPaymentEvent(prisma: any, id: string, error: any) {
  // Never persist SDK messages: they may contain request bodies, customer data or credentials.
  const category = error?.getStatus?.() === 409 ? 'association_or_state_conflict'
    : error?.getStatus?.() === 400 ? 'invalid_financial_data' : 'dependency_or_processing_failure';
  await prisma.paymentEvent.updateMany({ where: { id, processed_at: null }, data: { status: 'failed', error_category: category } });
  financialAudit({ event_id: id, processor: 'stripe', result: 'retryable_failure', error_category: category });
}
