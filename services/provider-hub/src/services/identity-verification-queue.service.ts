import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const IDENTITY_VERIFICATION_QUEUE = 'identity-verification';

@Injectable()
export class IdentityVerificationQueueService {
  constructor(
    @InjectQueue(IDENTITY_VERIFICATION_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueue(payload: {
    providerId: string;
    fullName: string;
    documentType: string;
    country: string;
    document: { buffer: Buffer; mimeType: string; filename: string };
  }) {
    await this.queue.add('verify-identity', payload);
  }
}
