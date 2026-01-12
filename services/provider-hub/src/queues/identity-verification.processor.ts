import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { IDENTITY_VERIFICATION_QUEUE } from '../services/identity-verification-queue.service';

@Processor(IDENTITY_VERIFICATION_QUEUE)
export class IdentityVerificationProcessor extends WorkerHost {
  async process(_job: Job): Promise<void> {
    // Placeholder processor; real verification handled by external service.
  }
}
