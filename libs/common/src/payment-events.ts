import { financialAudit } from './financial-audit';
// Only normalized, explicitly selected technical/financial fields belong in this inbox.
export async function receivePaymentEvent(prisma: any, id: string, type: string, payload: any) {
  try {
    await prisma.paymentEvent.upsert({ where: { id }, create: { id, type, payload, status: 'received' }, update: {} });
  } catch (error: any) {
    // Receipt runs outside the financial transaction. A concurrent first delivery
    // can win this insert; reload its durable row, never overwrite its payload/state.
    // Do not mask connection errors, other uniqueness failures or ambiguous metadata.
    if (error?.code !== 'P2002' || error.meta?.modelName !== 'PaymentEvent'
      || !Array.isArray(error.meta?.target) || error.meta.target.length !== 1
      || error.meta.target[0] !== 'id') throw error;
  }
  const current = await prisma.paymentEvent.findUnique({ where: { id } });
  if (current.processed_at) return false;
  const attempt = await prisma.paymentEvent.updateMany({ where: { id, processed_at: null }, data: {
    status: 'processing', attempts: { increment: 1 }, last_attempt_at: new Date(), error_category: null,
  } });
  if (attempt.count === 0) return false;
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
