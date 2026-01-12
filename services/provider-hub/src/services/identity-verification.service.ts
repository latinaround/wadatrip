import { Injectable } from '@nestjs/common';

export type ProviderVerifierResponse = {
  status?: 'pending' | 'verified' | 'rejected' | 'manual_review';
  decision?: 'pending' | 'verified' | 'rejected' | 'manual_review';
  match_score?: number | null;
  risk_level?: string | null;
  detectedName?: string | null;
  extracted_country?: string | null;
  extracted_id_number?: string | null;
  document_valid?: boolean;
};

@Injectable()
export class IdentityVerificationService {
  createResult(status: ProviderVerifierResponse['status'] = 'pending'): ProviderVerifierResponse {
    return {
      status,
      decision: status,
      match_score: null,
      risk_level: status === 'verified' ? 'low' : 'review',
      document_valid: false,
    };
  }

  async verifyDocument(_payload: {
    providerId: string;
    fullName: string;
    documentType: string;
    country: string;
    document: { buffer: Buffer; mimeType: string; filename: string };
  }): Promise<ProviderVerifierResponse> {
    // Placeholder for external verifier integration.
    return this.createResult('pending');
  }
}
