import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  BadRequestException,
  Query,
  UploadedFile,
  UseInterceptors,
  Req,
  UploadedFiles,
} from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { FileInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { join } from 'path';
import * as fs from 'fs';
import type { Express, Request } from 'express';
import {
  IdentityVerificationService,
  ProviderVerifierResponse,
} from '../services/identity-verification.service';
import { IdentityVerificationQueueService } from '../services/identity-verification-queue.service';

@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly identityVerification: IdentityVerificationService,
    private readonly identityVerificationQueue: IdentityVerificationQueueService,
  ) {}
  // ============================================================
  // LIST PROVIDERS
  // ============================================================
  @Get()
  async list(@Query() query: any) {
    const prisma = getPrisma();

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;

    if (query.q) {
      const q = String(query.q);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { base_city: { contains: q, mode: 'insensitive' } },
        { country_code: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.providers.count({ where }),
      prisma.providers.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { items, total, page, limit };
  }

  // ============================================================
  // CREATE PROVIDER (MANUAL)
  // ============================================================
  @Post()
  async create(@Body() body: any) {
    const prisma = getPrisma();

    const required = ['type', 'name', 'email', 'base_city', 'country_code'];
    for (const k of required) {
      if (!body[k]) throw new BadRequestException(`missing ${k}`);
    }

    const languages =
      typeof body.languages === 'string'
        ? body.languages.split(',').map((x: string) => x.trim())
        : Array.isArray(body.languages)
        ? body.languages
        : [];

    const data = {
      type: String(body.type),
      name: String(body.name),
      email: String(body.email),
      phone: body.phone ?? null,
      languages,
      base_city: body.base_city,
      country_code: body.country_code,
      status: 'pending',
      photo_url: body.photo_url ?? null,
      bio_short: body.bio_short ?? null,
      verified_level: String(body.verified_level || 'community').toLowerCase() === 'licensed' ? 'licensed' : 'community',
      license_url: body.license_url ?? null,
    };

    const created = await prisma.providers.create({
      data,
      include: { documents: true, listings: true },
    });

    // AI verifier
    try {
      const aiResResponse = await fetch(
        'http://localhost:3020/ai/verify/provider',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: created.name,
            email: created.email,
            base_city: created.base_city,
            country_code: created.country_code,
          }),
        },
      );
      const aiRes = (await aiResResponse.json()) as ProviderVerifierResponse;

      if (aiRes?.decision === 'verified') {
        await prisma.providers.update({
          where: { id: created.id },
          data: { status: 'approved', verification_status: 'approved' },
        });
      }
    } catch (err) {
      console.error('[AI Verifier] ERROR:', err);
    }

    return created;
  }

 // ============================================================
// DYNAMIC REGISTER (DOCUMENT + AUTO VERIFICATION)
// ============================================================
  @Post('register')
  @UseInterceptors(
    FileInterceptor('document', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'operators');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
      },
    }),
  })
)
  async register(@Body() body: any, @UploadedFile() file?: Express.Multer.File) {
    // TODO: Deprecated. Use POST /providers + POST /providers/:id/verify-identity
    const prisma = getPrisma();

  if (!body.name || !body.email) {
    throw new BadRequestException('Missing required fields');
  }

  const fileUrl = file ? `/uploads/operators/${file.filename}` : null;

  const data = {
    type: body.type || 'guide',
    name: body.name,
    email: body.email,
    phone: body.phone ?? null,
    languages: body.languages ? body.languages.split(',') : [],
    base_city: body.base_city ?? null,
    country_code: body.country_code ?? null,
    status: 'pending',
      photo_url: body.photo_url ?? null,
      bio_short: body.bio_short ?? null,
    verified_level: String(body.verified_level || 'community').toLowerCase() === 'licensed' ? 'licensed' : 'community',
    license_url: body.license_url ?? null,
  };

  const created = await prisma.providers.create({
    data,
    include: { documents: true },
  });

  let documentPayload: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
  } | null = null;

  if (fileUrl && file) {
    await prisma.provider_documents.create({
      data: {
        provider_id: created.id,
        doc_type: 'registration',
        url: fileUrl,
        status: 'pending',
      },
    });

    const absolutePath = join(process.cwd(), 'uploads', 'operators', file.filename);
    const fileBuffer = fs.readFileSync(absolutePath);
    documentPayload = {
      buffer: fileBuffer,
      mimeType: file.mimetype || 'image/jpeg',
      filename: file.originalname || file.filename,
    };
  }

  let verificationResult =
    this.identityVerification.createResult('not_provided');

  if (documentPayload) {
    await this.identityVerificationQueue.enqueue({
      providerId: created.id,
      fullName: body.name,
      documentType: body.documentType || 'id',
      country: body.country_code ?? 'US',
      document: documentPayload,
    });

    verificationResult = this.identityVerification.createResult('pending');

    await prisma.providers.update({
      where: { id: created.id },
      data: {
        verification_status: 'pending',
        verification_score: null,
        risk_level: null,
        detected_name: null,
        document_valid: false,
        status: 'pending',
      },
    });
  }

  const providerRecord = await prisma.providers.findUnique({
    where: { id: created.id },
    include: { documents: true },
  });

  return {
    provider: providerRecord,
    verification: verificationResult,
  };
}

  // ============================================================
  // VERIFY IDENTITY (MULTIPART)
  // ============================================================
  @Post(':id/verify-identity')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024, files: 5 },
    }),
  )
  async verifyIdentity(
    @Param('id') id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: any,
    @Req() req: Request,
  ) {
    console.log('[verify-identity] content-type:', req.headers['content-type']);
    const prisma = getPrisma();

    const provider = await prisma.providers.findUnique({ where: { id } });
    if (!provider) throw new BadRequestException('provider not found');

    const byField = (field: string) =>
      files?.find((f) => f.fieldname === field) || null;

    const fileMap = {
      id_document: byField('id_document'),
      selfie: byField('selfie'),
      license: byField('license'),
      business_registration: byField('business_registration'),
    };

    if (!fileMap.id_document || !fileMap.selfie) {
      throw new BadRequestException('id_document and selfie are required');
    }

    const uploadDir = join(process.cwd(), 'uploads', 'providers', id);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const saveFile = (file: Express.Multer.File, docType: string) => {
      const filename = `${Date.now()}-${file.originalname}`;
      const dest = join(uploadDir, filename);
      fs.writeFileSync(dest, file.buffer);
      return { url: `/uploads/providers/${id}/${filename}`, docType };
    };

    const savedDocs: { url: string; docType: string }[] = [];
    for (const [key, file] of Object.entries(fileMap)) {
      if (file) {
        const saved = saveFile(file, key);
        savedDocs.push(saved);
        await prisma.provider_documents.create({
          data: {
            provider_id: id,
            doc_type: key,
            url: saved.url,
            status: 'pending',
            notes: null,
          },
        });
      }
    }

    // Fake verification (simulated OCR/face match)
    const idFile = fileMap.id_document;
    const ocrResult = idFile
      ? await this.identityVerification.verifyDocument({
          providerId: id,
          fullName: body.fullName ?? provider.name,
          documentType: body.documentType ?? 'id',
          country: body.country ?? provider.country_code ?? 'US',
          document: {
            buffer: idFile.buffer,
            mimeType: idFile.mimetype || 'image/jpeg',
            filename: idFile.originalname || 'document.jpg',
          },
        })
      : this.identityVerification.createResult('manual_review');

    const statusFromOcr =
      ocrResult.status === 'verified' || ocrResult.decision === 'verified'
        ? 'approved'
        : ocrResult.status === 'rejected'
        ? 'rejected'
        : 'pending';
    const score = typeof ocrResult.match_score === 'number' ? ocrResult.match_score : null;

    // Face match (TODO real endpoint ready in ai-verifier)
    let faceMatchRes: Response | null = null;
    if (fileMap.selfie && fileMap.id_document) {
      const formData = new (require('form-data'))();
      formData.append('selfie', fileMap.selfie.buffer, {
        filename: fileMap.selfie.originalname || 'selfie.jpg',
        contentType: fileMap.selfie.mimetype || 'image/jpeg',
      });
      formData.append('id_document', fileMap.id_document.buffer, {
        filename: fileMap.id_document.originalname || 'id.jpg',
        contentType: fileMap.id_document.mimetype || 'image/jpeg',
      });
      faceMatchRes = await fetch('http://localhost:3020/verify/face-match', {
        method: 'POST',
        body: formData as any,
      }).catch(() => null);
    }

    let faceMatch: boolean | null = null;
    let faceConfidence: number | null = null;
    let faceNotes: string | null = null;
    if (faceMatchRes && faceMatchRes.ok) {
      const faceData = await faceMatchRes.json().catch(() => null);
      if (faceData) {
        faceMatch = typeof faceData.match_faces === 'boolean' ? faceData.match_faces : null;
        faceConfidence =
          typeof faceData.confidence === 'number' ? faceData.confidence : null;
        faceNotes = faceData.notes ?? null;
      }
    }

    let status = statusFromOcr;
    const notes: string[] = [];
    if (ocrResult.decision) notes.push(String(ocrResult.decision));
    if (faceNotes) notes.push(faceNotes);
    if (faceMatch === false) {
      status = 'rejected';
      notes.push('Face mismatch');
    }

    await prisma.providers.update({
      where: { id },
      data: {
        verification_status: status,
        verification_score: score,
        risk_level: ocrResult.risk_level ?? (status === 'approved' ? 'low' : 'review'),
        detected_name: ocrResult.detectedName ?? body.fullName ?? provider.name,
        document_valid: ocrResult.document_valid ?? false,
        status: status === 'approved' ? 'approved' : (status === 'rejected' ? 'rejected' : 'pending'),
        extracted_country: ocrResult?.extracted_country ?? null,
        extracted_id_number: ocrResult?.extracted_id_number ?? null,
        match_faces: faceMatch,
        verification_notes: notes.join(' | ') || null,
        phone: body.phone ?? provider.phone,
        base_city: body.city ?? provider.base_city,
        country_code: body.country ?? provider.country_code,
        languages: Array.isArray(body.languages)
          ? body.languages
          : typeof body.languages === 'string'
          ? body.languages.split(',').map((x: string) => x.trim())
          : provider.languages,
        type: body.operator_type ?? provider.type,
      },
    });

    return {
      message: 'Identity verification processed',
      verification: {
        status,
        score,
        match_faces: faceMatch,
        document_valid: ocrResult.document_valid ?? false,
        risk_level: ocrResult.risk_level ?? null,
      },
      documents: savedDocs,
    };
  }

  @Get(':id/verification-status')
  async verificationStatus(@Param('id') id: string) {
    const prisma = getPrisma();
    const provider = await prisma.providers.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!provider) throw new BadRequestException('provider not found');
    return {
      id: provider.id,
      verification_status: provider.verification_status,
      verification_score: provider.verification_score,
      risk_level: provider.risk_level,
      detected_name: provider.detected_name,
      document_valid: provider.document_valid,
      documents: provider.documents,
    };
  }

  @Post(':id/resubmit')
  async resubmit(@Param('id') id: string) {
    const prisma = getPrisma();
    const provider = await prisma.providers.findUnique({ where: { id } });
    if (!provider) throw new BadRequestException('provider not found');

    await prisma.providers.update({
      where: { id },
      data: {
        verification_status: 'pending',
        verification_score: null,
        risk_level: null,
        detected_name: null,
        document_valid: false,
        status: 'pending',
      },
    });

    return { message: 'resubmitted' };
  }

@Post(':id/verify')
  async verify(@Param('id') id: string, @Body() body: any) {
    const prisma = getPrisma();
    const rawStatus = String(body?.status || '').toLowerCase();
    const status = rawStatus === 'verified' ? 'approved' : rawStatus;

    if (!['approved', 'rejected'].includes(status))
      throw new BadRequestException('status must be approved|rejected');

    await prisma.providers.update({
      where: { id },
      data: {
        verification_status: status,
        status: status === 'approved' ? 'approved' : 'rejected',
        stripe_account_id: body.stripe_account_id ?? undefined,
      },
    });

    return { message: 'updated' };
  }

  // ============================================================
  // GET ONE PROVIDER
  // ============================================================
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const prisma = getPrisma();

    const provider = await prisma.providers.findUnique({
      where: { id },
      include: { documents: true, listings: true },
    });

    if (!provider) throw new BadRequestException('provider not found');
    return provider;
  }
}
