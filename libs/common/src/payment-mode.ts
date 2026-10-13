import { ConflictException } from '@nestjs/common';

export type PaymentMode = 'test' | 'live';

export function assertPaymentMode(record: any, mode: PaymentMode) {
  if (record?.processor_mode === mode) return;
  // Unknown history can be investigated in Test, never used to authorize Live IO.
  if (mode === 'test' && record?.processor_mode == null) return;
  throw new ConflictException('Payment mode is unknown or does not match the processor');
}
