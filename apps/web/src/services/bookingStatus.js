// Presentation derives only from the authenticated backend result, never the redirect URL.
export function bookingStatusMessage(booking) {
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
