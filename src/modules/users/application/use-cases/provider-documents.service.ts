import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  BackgroundCheckEntity,
  ProviderProfileEntity,
} from '@/database/entities';
import { ProviderVerificationStatus, RoleName } from '@/database/enums';
import { TENANT_DATA_SOURCE } from '@/tenant';
import {
  DecideProviderDocumentDto,
  ProviderDocumentDecision,
  ProviderDocumentResponseDto,
  ProviderDocumentStatus,
  ProviderReviewItemDto,
  ProviderReviewQueryDto,
  VerificationAction,
} from '../dtos';
import { UploadProviderDocumentDto } from '../dtos/upload-provider-document.dto';
import { ProviderProfileService } from './provider-profile.service';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

type UploadableFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
};

@Injectable()
export class ProviderDocumentsService {
  private readonly profileRepo: Repository<ProviderProfileEntity>;
  private readonly backgroundCheckRepo: Repository<BackgroundCheckEntity>;

  constructor(
    @Inject(TENANT_DATA_SOURCE)
    dataSource: DataSource,
    private readonly providerProfileService: ProviderProfileService,
  ) {
    this.profileRepo = dataSource.getRepository(ProviderProfileEntity);
    this.backgroundCheckRepo = dataSource.getRepository(BackgroundCheckEntity);
  }

  async uploadMyDocument(
    providerUserId: string,
    dto: UploadProviderDocumentDto,
    file?: UploadableFile,
  ): Promise<
    ProviderDocumentResponseDto & { extractedDocumentNumber: string | null }
  > {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    this.validateFile(file);

    const profile = await this.profileRepo.findOne({
      where: { userId: providerUserId },
    });

    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }

    const fileBuffer = file.buffer;
    if (!fileBuffer) {
      throw new BadRequestException('Uploaded file buffer is empty');
    }

    const documentHash = createHash('sha256').update(fileBuffer).digest('hex');
    const fileUrl = await this.persistFile(providerUserId, file, fileBuffer);

    const existingPending = await this.backgroundCheckRepo.findOne({
      where: {
        providerProfileId: profile.id,
        status: ProviderDocumentStatus.PENDING_REVIEW,
      },
      order: { createdAt: 'DESC' },
    });

    if (existingPending) {
      throw new ConflictException(
        'There is already a pending document review for this provider',
      );
    }

    const created = this.backgroundCheckRepo.create({
      providerProfileId: profile.id,
      documentType: dto.documentType.trim(),
      documentHash,
      fileUrl,
      issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      verifiedAt: null,
      verifiedBy: null,
      status: ProviderDocumentStatus.PENDING_REVIEW,
      rejectionReason: null,
    });

    const saved = await this.backgroundCheckRepo.save(created);

    if (profile.verificationStatus !== ProviderVerificationStatus.VERIFIED) {
      await this.profileRepo.update(
        { id: profile.id },
        { verificationStatus: ProviderVerificationStatus.UNDER_REVIEW },
      );
    }

    return {
      ...this.mapDocument(saved),
      extractedDocumentNumber:
        dto.documentNumber ??
        this.extractDocumentNumberCandidate(file.originalname),
    };
  }

  async listReviewQueue(query: ProviderReviewQueryDto): Promise<{
    items: ProviderReviewItemDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 0;
    const limit = query.limit ?? 20;
    const status = query.status ?? ProviderDocumentStatus.PENDING_REVIEW;

    const [rows, total] = await this.backgroundCheckRepo.findAndCount({
      where: { status },
      relations: ['provider', 'provider.user'],
      order: { createdAt: 'DESC' },
      skip: page * limit,
      take: limit,
    });

    const items: ProviderReviewItemDto[] = rows.map((row) => ({
      documentId: row.id,
      providerUserId: row.provider.userId,
      providerProfileId: row.providerProfileId,
      providerFullName: row.provider.user?.fullName || 'Unknown provider',
      providerDocumentId: row.provider.user?.documentId || null,
      documentType: row.documentType,
      documentStatus: row.status as ProviderDocumentStatus,
      providerVerificationStatus: row.provider.verificationStatus,
      createdAt: row.createdAt,
    }));

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async listProviderDocuments(
    providerUserId: string,
  ): Promise<ProviderDocumentResponseDto[]> {
    const profile = await this.profileRepo.findOne({
      where: { userId: providerUserId },
    });

    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }

    const docs = await this.backgroundCheckRepo.find({
      where: { providerProfileId: profile.id },
      order: { createdAt: 'DESC' },
    });

    return docs.map((doc) => this.mapDocument(doc));
  }

  async decideDocument(
    providerUserId: string,
    documentId: string,
    reviewerUserId: string,
    reviewerRoles: RoleName[],
    dto: DecideProviderDocumentDto,
  ): Promise<{
    document: ProviderDocumentResponseDto;
    provider: Awaited<ReturnType<ProviderProfileService['verifyProvider']>>;
  }> {
    if (
      !reviewerRoles.some((role) =>
        [RoleName.ADMIN, RoleName.MODERATOR].includes(role),
      )
    ) {
      throw new BadRequestException(
        'Only ADMIN or MODERATOR can verify documents',
      );
    }

    const profile = await this.profileRepo.findOne({
      where: { userId: providerUserId },
    });

    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }

    const document = await this.backgroundCheckRepo.findOne({
      where: {
        id: documentId,
        providerProfileId: profile.id,
      },
    });

    if (!document) {
      throw new NotFoundException('Provider document not found');
    }

    document.verifiedBy = reviewerUserId;
    document.verifiedAt = new Date();

    if (dto.decision === ProviderDocumentDecision.APPROVED) {
      document.status = ProviderDocumentStatus.APPROVED;
      document.rejectionReason = null;

      const saved = await this.backgroundCheckRepo.save(document);
      const provider = await this.providerProfileService.verifyProvider(
        providerUserId,
        VerificationAction.APPROVE,
      );

      return {
        document: this.mapDocument(saved),
        provider,
      };
    }

    document.status = ProviderDocumentStatus.REJECTED;
    document.rejectionReason =
      dto.reason?.trim() || 'Rejected during manual review';

    const saved = await this.backgroundCheckRepo.save(document);
    const provider = await this.providerProfileService.verifyProvider(
      providerUserId,
      VerificationAction.REJECT,
    );

    return {
      document: this.mapDocument(saved),
      provider,
    };
  }

  private mapDocument(doc: BackgroundCheckEntity): ProviderDocumentResponseDto {
    return {
      id: doc.id,
      providerProfileId: doc.providerProfileId,
      documentType: doc.documentType,
      documentHash: doc.documentHash,
      fileUrl: doc.fileUrl,
      issuedAt: doc.issuedAt,
      expiresAt: doc.expiresAt,
      verifiedAt: doc.verifiedAt,
      verifiedBy: doc.verifiedBy,
      status: doc.status as ProviderDocumentStatus,
      rejectionReason: doc.rejectionReason,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private validateFile(file: UploadableFile): void {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Use PDF, JPG, or PNG',
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 5MB limit');
    }
  }

  private async persistFile(
    providerUserId: string,
    file: UploadableFile,
    buffer: Buffer,
  ): Promise<string> {
    const extension = extname(file.originalname || '').toLowerCase();
    const safeExtension = extension || this.inferExtension(file.mimetype);

    const relativeDir = join('uploads', 'provider-documents', providerUserId);
    const absoluteDir = join(process.cwd(), relativeDir);
    await mkdir(absoluteDir, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}${safeExtension}`;
    const absolutePath = join(absoluteDir, filename);

    await writeFile(absolutePath, buffer);

    return `/${relativeDir.replace(/\\/g, '/')}/${filename}`;
  }

  private inferExtension(mimeType: string): string {
    if (mimeType === 'application/pdf') return '.pdf';
    if (mimeType === 'image/png') return '.png';
    return '.jpg';
  }

  private extractDocumentNumberCandidate(fileName: string): string | null {
    const match = fileName.match(/\d{6,12}/);
    return match?.[0] ?? null;
  }
}
