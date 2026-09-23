// Presentation derives only from the authenticated backend result, never the redirect URL.
export function bookingStatusMessage(booking) {
  if (booking?.status === 'cancelled' && booking?.payment_status === 'refunded') {
    return { kind: 'cancelled', title: 'Booking cancelled', body: 'Your refund has been processed. Your bank may take time to show it.' };
  }
  if (booking?.status === 'cancelled' && booking?.cancellation_requested_at && booking?.cancellation_refund_due === false) {
    return { kind: 'cancelled', title: 'Booking cancelled', body: 'This cancellation was requested after the free cancellation deadline. No automatic refund is due under the accepted policy. Contact support if the operator did not provide the service.' };
  }
  if (booking?.status === 'reconciliation_required' && booking?.cancellation_requested_at && booking?.cancellation_refund_due) {
    return { kind: 'review', title: 'Cancellation received', body: 'Your booking will not go ahead. Your refund is being processed or reviewed; it is not yet confirmed. Do not pay again.' };
  }
  if (['confirmed', 'completed'].includes(booking?.status) && booking?.payment_status === 'paid') {
    return { kind: 'confirmed', title: 'Your booking is confirmed', body: 'Your reservation has been confirmed by Wadatrip.' };
  }
  if (booking?.status === 'cancelled' && booking?.payment_status !== 'paid') {
    return { kind: 'cancelled', title: 'Booking cancelled', body: 'This booking is cancelled.' };
  }
  if (booking?.status === 'reconciliation_required' || (booking?.status === 'cancelled' && booking?.payment_status === 'paid')) {
    return { kind: 'review', title: 'Payment requires review', body: 'Your booking is not confirmed. Wadatrip must review the payment and any refund due. Do not pay again.' };
  }
  return { kind: 'pending', title: 'Booking status pending', body: booking?.status === 'cancellation_pending'
    ? 'Cancellation is being checked with the payment processor. It is not final yet. Do not pay again.'
    : 'Your booking is not confirmed yet. Refresh its status before taking further action. Do not pay again.' };
}
