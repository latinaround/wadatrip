import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const IDENTITY_VERIFICATION_QUEUE = 'identity-verification';

@Injectable()
export class IdentityVerificationQueueService {
  constructor(
    @Optional()
    @InjectQueue(IDENTITY_VERIFICATION_QUEUE)
    private readonly queue?: Queue,
  ) {}

  async enqueue(payload: {
    providerId: string;
    fullName: string;
    documentType: string;
    country: string;
    document: { buffer: Buffer; mimeType: string; filename: string };
  }) {
    if (!this.queue) {
      try {
        console.warn('[provider-hub] Redis queue unavailable, skipping identity verification enqueue.');
      } catch {}
      return;
    }
    await this.queue.add('verify-identity', payload);
  }
}
