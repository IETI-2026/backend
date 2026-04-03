import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { DataSource, Repository } from 'typeorm';
import { BlobStorageService } from '@/common/services/blob-storage.service';
import {
  UserEntity as DbUserEntity,
  ProviderProfileEntity,
  ServiceRequestEntity,
  ServiceRequestEventEntity,
  ServiceRequestTechnicianResponseEntity,
} from '@/database/entities';
import {
  ProviderVerificationStatus,
  ServiceRequestStatus,
  TechnicianResponseStatus,
  UrgencyLevel,
} from '@/database/enums';
import {
  TENANT_DATA_SOURCE,
  TenantContext,
  TenantDataSourceService,
} from '@/tenant';
import { ServiceRequestsGateway } from '../../presentation/gateways/service-requests.gateway';
import {
  type AcceptedTechnicianUserDto,
  type AcceptServiceRequestDto,
  type ChooseTechnicianDto,
  type CreateServiceRequestDto,
  type GetServiceRequestsQueryDto,
  type MarkCompleteDto,
  type RejectServiceRequestDto,
  ServiceRequestResponseDto,
} from '../dtos';
import type { RateServiceRequestDto } from '../dtos/rate-service-request.dto';

type AgentClassificationResponse = {
  categoria?: unknown;
  categoría?: unknown;
  urgencia?: unknown;
};

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
};

@Injectable()
export class ServiceRequestsService {
  private readonly logger = new Logger(ServiceRequestsService.name);
  private readonly requestRepo: Repository<ServiceRequestEntity>;
  private readonly responseRepo: Repository<ServiceRequestTechnicianResponseEntity>;
  private readonly eventRepo: Repository<ServiceRequestEventEntity>;
  private readonly tenantUserRepo: Repository<DbUserEntity>;

  constructor(
    @Inject(TENANT_DATA_SOURCE)
    dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly tenantDataSourceService: TenantDataSourceService,
    private readonly tenantContext: TenantContext,
    private readonly gateway: ServiceRequestsGateway,
    private readonly blobStorageService: BlobStorageService,
  ) {
    this.requestRepo = dataSource.getRepository(ServiceRequestEntity);
    this.responseRepo = dataSource.getRepository(
      ServiceRequestTechnicianResponseEntity,
    );
    this.eventRepo = dataSource.getRepository(ServiceRequestEventEntity);
    this.tenantUserRepo = dataSource.getRepository(DbUserEntity);
  }

  private async getPublicUserRepo(): Promise<Repository<DbUserEntity>> {
    const publicDataSource =
      await this.tenantDataSourceService.getDataSource('public');
    return publicDataSource.getRepository(DbUserEntity);
  }

  async create(
    dto: CreateServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    const publicUserRepo = await this.getPublicUserRepo();
    const user = await publicUserRepo.findOne({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    await this.ensureTenantUserProjection(user);

    const classification = await this.classifyProblemWithAgent(dto.problema);

    const entity = this.requestRepo.create({
      userId: dto.userId,
      rawDescription: dto.problema,
      serviceCity: dto.serviceCity.trim().toLowerCase(),
      requestedSkills: classification.skills,
      latitude: dto.latitude,
      longitude: dto.longitude,
      addressText: dto.addressText,
      urgency: classification.urgency,
    });
    const saved = await this.requestRepo.save(entity);

    const request = await this.requestRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['technicianResponses'],
    });

    const response = this.toResponse(request);
    const tenantId = this.tenantContext.getTenantId() ?? 'public';
    this.gateway.emitNewServiceRequest(tenantId, response);
    return response;
  }

  async findById(serviceRequestId: string): Promise<ServiceRequestResponseDto> {
    return this.findByIdOrThrow(serviceRequestId);
  }

  async findAll(query: GetServiceRequestsQueryDto): Promise<{
    requests: ServiceRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 0;
    const limit = query.limit ?? 20;
    const serviceCity = query.serviceCity?.trim().toLowerCase();

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (query.technicianUserId)
      where.assignedTechnicianId = query.technicianUserId;
    if (serviceCity) where.serviceCity = serviceCity;
    if (query.isRated !== undefined) where.isRated = query.isRated;

    const [requests, total] = await this.requestRepo.findAndCount({
      where,
      skip: page * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['technicianResponses', 'assignedTechnician'],
    });

    this.logger.log(
      `findAll where=${JSON.stringify(where)} tenant=${this.tenantContext.getTenantId()} total=${total}`,
    );

    return {
      requests: requests.map((request) => this.toResponse(request)),
      total,
      page,
      limit,
    };
  }

  async findAcceptedTechnicians(
    serviceRequestId: string,
  ): Promise<AcceptedTechnicianUserDto[]> {
    const serviceRequest = await this.requestRepo.findOne({
      where: { id: serviceRequestId },
      select: ['id'],
    });

    if (!serviceRequest) {
      throw new NotFoundException(
        `Service request with ID ${serviceRequestId} not found`,
      );
    }

    const responses = await this.responseRepo.find({
      where: {
        serviceRequestId,
        status: TechnicianResponseStatus.ACCEPTED,
      },
      order: { respondedAt: 'DESC' },
      relations: ['technicianUser'],
    });

    return responses.map((response) => ({
      id: response.technicianUser.id,
      fullName: response.technicianUser.fullName,
      email: response.technicianUser.email,
      phoneNumber: response.technicianUser.phoneNumber,
      skills: response.technicianUser.skills,
      profilePhotoUrl: response.technicianUser.profilePhotoUrl,
      currentLatitude: response.technicianUser.currentLatitude,
      currentLongitude: response.technicianUser.currentLongitude,
      respondedAt: response.respondedAt,
    }));
  }

  async findAvailableForTechnician(
    technicianUserId: string,
  ): Promise<ServiceRequestResponseDto[]> {
    const publicUserRepo = await this.getPublicUserRepo();
    const technician = await publicUserRepo.findOne({
      where: { id: technicianUserId },
    });

    if (!technician) {
      throw new NotFoundException(
        `Technician user with ID ${technicianUserId} not found`,
      );
    }

    await this.ensureTenantUserProjection(technician);

    const normalizedSkills = this.normalizeSkills(technician.skills);

    if (normalizedSkills.length === 0) {
      return [];
    }
    const qb = this.requestRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.technicianResponses', 'tr')
      .leftJoinAndSelect('sr.assignedTechnician', 'at')
      .where('sr.status = :status', { status: ServiceRequestStatus.REQUESTED })
      .andWhere('sr."requestedSkills" && :skills', { skills: normalizedSkills })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM service_request_technician_responses trx
          WHERE trx."serviceRequestId" = sr.id
          AND trx."technicianUserId" = :technicianUserId
        )`,
        { technicianUserId },
      )
      .orderBy('sr."createdAt"', 'DESC');

    const requests = await qb.getMany();

    return requests.map((request) => this.toResponse(request));
  }

  async accept(
    serviceRequestId: string,
    dto: AcceptServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    const publicUserRepo = await this.getPublicUserRepo();
    const technician = await publicUserRepo.findOne({
      where: { id: dto.technicianUserId },
    });

    if (!technician) {
      throw new NotFoundException(
        `Technician user with ID ${dto.technicianUserId} not found`,
      );
    }

    const providerProfile = await publicUserRepo.manager
      .getRepository(ProviderProfileEntity)
      .findOne({ where: { userId: dto.technicianUserId } });

    if (
      !providerProfile ||
      providerProfile.verificationStatus !== ProviderVerificationStatus.VERIFIED
    ) {
      throw new ForbiddenException(
        'Technician is not verified and cannot accept service requests',
      );
    }

    await this.ensureTenantUserProjection(technician);

    const request = await this.requestRepo.findOne({
      where: { id: serviceRequestId },
      select: ['id', 'status'],
    });

    if (!request) {
      throw new NotFoundException(
        `Service request with ID ${serviceRequestId} not found`,
      );
    }

    if (request.status !== ServiceRequestStatus.REQUESTED) {
      throw new ConflictException(
        `Service request ${serviceRequestId} is not available for acceptance`,
      );
    }
    let existingResponse = await this.responseRepo.findOne({
      where: { serviceRequestId, technicianUserId: dto.technicianUserId },
    });

    if (existingResponse) {
      existingResponse.status = TechnicianResponseStatus.ACCEPTED;
      existingResponse.reason = null;
      existingResponse.respondedAt = new Date();
      await this.responseRepo.save(existingResponse);
    } else {
      existingResponse = this.responseRepo.create({
        serviceRequestId,
        technicianUserId: dto.technicianUserId,
        status: TechnicianResponseStatus.ACCEPTED,
        respondedAt: new Date(),
      });
      await this.responseRepo.save(existingResponse);
    }

    const event = this.eventRepo.create({
      serviceRequestId,
      previousStatus: ServiceRequestStatus.REQUESTED,
      newStatus: ServiceRequestStatus.REQUESTED,
      triggeredBy: dto.technicianUserId,
      metadata: { action: 'TECHNICIAN_ACCEPTED' },
    });
    await this.eventRepo.save(event);

    const technicianPayload: AcceptedTechnicianUserDto = {
      id: technician.id,
      fullName: technician.fullName,
      email: technician.email,
      phoneNumber: technician.phoneNumber,
      skills: technician.skills,
      profilePhotoUrl: technician.profilePhotoUrl,
      currentLatitude: technician.currentLatitude,
      currentLongitude: technician.currentLongitude,
      respondedAt: existingResponse.respondedAt,
    };
    this.gateway.emitTechnicianAccepted(serviceRequestId, technicianPayload);

    return this.findByIdOrThrow(serviceRequestId);
  }

  async reject(
    serviceRequestId: string,
    dto: RejectServiceRequestDto,
  ): Promise<{ message: string }> {
    const publicUserRepo = await this.getPublicUserRepo();
    const technician = await publicUserRepo.findOne({
      where: { id: dto.technicianUserId },
    });

    if (!technician) {
      throw new NotFoundException(
        `Technician user with ID ${dto.technicianUserId} not found`,
      );
    }

    await this.ensureTenantUserProjection(technician);

    const request = await this.requestRepo.findOne({
      where: { id: serviceRequestId },
      select: ['id', 'status'],
    });

    if (!request) {
      throw new NotFoundException(
        `Service request with ID ${serviceRequestId} not found`,
      );
    }

    if (request.status !== ServiceRequestStatus.REQUESTED) {
      throw new ConflictException(
        `Service request ${serviceRequestId} cannot be rejected in status ${request.status}`,
      );
    }
    let existingResponse = await this.responseRepo.findOne({
      where: { serviceRequestId, technicianUserId: dto.technicianUserId },
    });

    if (existingResponse) {
      existingResponse.status = TechnicianResponseStatus.REJECTED;
      existingResponse.reason = dto.reason ?? null;
      existingResponse.respondedAt = new Date();
      await this.responseRepo.save(existingResponse);
    } else {
      existingResponse = this.responseRepo.create({
        serviceRequestId,
        technicianUserId: dto.technicianUserId,
        status: TechnicianResponseStatus.REJECTED,
        reason: dto.reason ?? null,
        respondedAt: new Date(),
      });
      await this.responseRepo.save(existingResponse);
    }

    const event = this.eventRepo.create({
      serviceRequestId,
      previousStatus: ServiceRequestStatus.REQUESTED,
      newStatus: ServiceRequestStatus.REQUESTED,
      triggeredBy: dto.technicianUserId,
      notes: dto.reason ?? null,
      metadata: { action: 'TECHNICIAN_REJECTED' },
    });
    await this.eventRepo.save(event);

    return {
      message: `Service request ${serviceRequestId} rejected by technician ${dto.technicianUserId}`,
    };
  }

  async chooseTechnician(
    serviceRequestId: string,
    dto: ChooseTechnicianDto,
  ): Promise<ServiceRequestResponseDto> {
    const request = await this.requestRepo.findOne({
      where: { id: serviceRequestId },
      select: ['id', 'userId', 'status', 'latitude', 'longitude'],
    });

    if (!request) {
      throw new NotFoundException(
        `Service request with ID ${serviceRequestId} not found`,
      );
    }

    if (request.userId !== dto.customerUserId) {
      throw new ConflictException(
        `User ${dto.customerUserId} is not the owner of service request ${serviceRequestId}`,
      );
    }

    if (request.status !== ServiceRequestStatus.REQUESTED) {
      throw new ConflictException(
        `Service request ${serviceRequestId} cannot choose technician in status ${request.status}`,
      );
    }

    const acceptedResponse = await this.responseRepo.findOne({
      where: {
        serviceRequestId,
        technicianUserId: dto.technicianUserId,
      },
      select: ['status'],
    });

    if (
      !acceptedResponse ||
      acceptedResponse.status !== TechnicianResponseStatus.ACCEPTED
    ) {
      throw new ConflictException(
        `Technician ${dto.technicianUserId} has not accepted service request ${serviceRequestId}`,
      );
    }

    const publicUserRepo = await this.getPublicUserRepo();
    const technician = await publicUserRepo.findOne({
      where: { id: dto.technicianUserId },
      select: ['id', 'currentLatitude', 'currentLongitude'],
    });

    let displacementDistanceKm: number | null = null;
    if (
      technician?.currentLatitude != null &&
      technician?.currentLongitude != null
    ) {
      const distanceMeters = this.haversineDistance(
        request.latitude,
        request.longitude,
        technician.currentLatitude ?? 0,
        technician.currentLongitude ?? 0,
      );
      displacementDistanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    }

    await this.requestRepo.update(serviceRequestId, {
      assignedTechnicianId: dto.technicianUserId,
      status: ServiceRequestStatus.ON_THE_WAY,
      assignedAt: new Date(),
      displacementDistanceKm,
      finalPrice: '58000',
    });

    const event = this.eventRepo.create({
      serviceRequestId,
      previousStatus: ServiceRequestStatus.REQUESTED,
      newStatus: ServiceRequestStatus.ON_THE_WAY,
      triggeredBy: dto.customerUserId,
      metadata: {
        action: 'CUSTOMER_SELECTED_TECHNICIAN',
        technicianUserId: dto.technicianUserId,
      },
    });
    await this.eventRepo.save(event);

    const updated = await this.findByIdOrThrow(serviceRequestId);
    this.gateway.emitServiceStatusUpdated(serviceRequestId, updated.status);
    return updated;
  }

  async markComplete(
    serviceRequestId: string,
    dto: MarkCompleteDto,
  ): Promise<ServiceRequestResponseDto> {
    const request = await this.requestRepo.findOne({
      where: { id: serviceRequestId },
    });

    if (!request) {
      throw new NotFoundException(
        `Service request with ID ${serviceRequestId} not found`,
      );
    }

    if (
      request.status !== ServiceRequestStatus.ON_THE_WAY &&
      request.status !== ServiceRequestStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        `Service request ${serviceRequestId} cannot be marked complete in status ${request.status}`,
      );
    }

    if (dto.role === 'client' && request.userId !== dto.userId) {
      throw new BadRequestException(
        `User ${dto.userId} is not the client of this service request`,
      );
    }

    if (
      dto.role === 'technician' &&
      request.assignedTechnicianId !== dto.userId
    ) {
      throw new BadRequestException(
        `User ${dto.userId} is not the assigned technician of this service request`,
      );
    }

    const bothComplete =
      (dto.role === 'client' ? true : request.clientMarkedComplete) &&
      (dto.role === 'technician' ? true : request.technicianMarkedComplete);

    const updatePayload: Record<string, unknown> = {};
    if (dto.role === 'client') {
      updatePayload.clientMarkedComplete = true;
    } else {
      updatePayload.technicianMarkedComplete = true;
    }
    if (bothComplete) {
      updatePayload.status = ServiceRequestStatus.COMPLETED;
      updatePayload.completedAt = new Date();
    }

    await this.requestRepo.update(serviceRequestId, updatePayload);

    if (bothComplete && request.assignedTechnicianId) {
      await this.tenantUserRepo.increment(
        { id: request.assignedTechnicianId },
        'servicesCount',
        1,
      );
      const publicUserRepo = await this.getPublicUserRepo();
      await publicUserRepo.increment(
        { id: request.assignedTechnicianId },
        'servicesCount',
        1,
      );
      const updatedTech = await this.tenantUserRepo.findOne({
        where: { id: request.assignedTechnicianId },
        select: ['servicesCount'],
      });
      this.gateway.emitTechnicianStatsUpdated(
        request.assignedTechnicianId,
        updatedTech?.servicesCount ?? 0,
      );
    }

    const event = this.eventRepo.create({
      serviceRequestId,
      previousStatus: request.status,
      newStatus: bothComplete ? ServiceRequestStatus.COMPLETED : request.status,
      triggeredBy: dto.userId,
      metadata: { action: `${dto.role.toUpperCase()}_MARKED_COMPLETE` },
    });
    await this.eventRepo.save(event);

    const updated = await this.findByIdOrThrow(serviceRequestId);
    this.gateway.emitServiceStatusUpdated(serviceRequestId, updated.status);

    if (bothComplete) {
      setImmediate(() => {
        this.generateServiceSummaryPdf(serviceRequestId).catch((err: Error) => {
          this.logger.error(
            `Receipt generation failed for ${serviceRequestId}: ${err.message}`,
          );
        });
      });
    }

    return updated;
  }

  async generateServiceSummaryPdf(
    serviceRequestId: string,
  ): Promise<{ url: string; buffer: Buffer }> {
    const request = await this.requestRepo.findOne({
      where: { id: serviceRequestId },
      relations: ['assignedTechnician'],
    });

    if (!request) {
      throw new NotFoundException(
        `Service request with ID ${serviceRequestId} not found`,
      );
    }

    if (request.status !== ServiceRequestStatus.COMPLETED) {
      throw new BadRequestException(
        'Service summary can only be generated for completed services',
      );
    }

    // Return cached URL if receipt was already generated
    if (request.receiptUrl) {
      return { url: request.receiptUrl, buffer: Buffer.alloc(0) };
    }

    const publicUserRepo = await this.getPublicUserRepo();
    const clientUser = await publicUserRepo.findOne({
      where: { id: request.userId },
      select: ['id', 'email'],
    });

    const technicianName = request.assignedTechnician?.fullName ?? 'N/A';
    const categoryName =
      request.requestedSkills.length > 0 ? request.requestedSkills[0] : 'N/A';
    const urgency = request.urgency ?? 'media';
    const finalPrice = request.finalPrice ? Number(request.finalPrice) : 0;
    const displacementKm = request.displacementDistanceKm ?? 0;

    let durationText = 'N/A';
    if (request.startedAt && request.completedAt) {
      const diffMs =
        request.completedAt.getTime() - request.startedAt.getTime();
      const totalMinutes = Math.round(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      durationText = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
    }

    const completedDate = request.completedAt
      ? request.completedAt.toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'N/A';

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Uint8Array[] = [];
      doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('Servicio Completado', { align: 'center' });
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(completedDate, { align: 'center' });
      doc.moveDown(1.5);

      doc.fontSize(14).font('Helvetica-Bold').text('Tecnico asignado');
      doc.fontSize(12).font('Helvetica').text(technicianName);
      doc.moveDown(1);

      doc.fontSize(14).font('Helvetica-Bold').text('Detalles del servicio');
      doc.moveDown(0.5);

      const detailsLeft = 50;
      const detailsRight = 350;
      const details = [
        ['Categoria', categoryName],
        ['Urgencia', urgency],
        ['Duracion', durationText],
        ['Distancia', `${displacementKm} km`],
      ];
      for (const [label, value] of details) {
        const y = doc.y;
        doc.fontSize(12).font('Helvetica').text(label, detailsLeft, y);
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(value, detailsRight, y, { align: 'right' });
        doc.moveDown(0.3);
      }

      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);

      doc.fontSize(16).font('Helvetica-Bold').text('Total');
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(
          `$${finalPrice.toLocaleString('es-CO')}`,
          detailsRight - 50,
          doc.y - 26,
          { align: 'right' },
        );

      doc.end();
    });

    const fileName = `recibo_${serviceRequestId.substring(0, 8)}.pdf`;
    const url = await this.blobStorageService.uploadBuffer(
      pdfBuffer,
      fileName,
      'application/pdf',
      clientUser?.email ?? undefined,
    );

    await this.requestRepo.update(serviceRequestId, { receiptUrl: url });

    return { url, buffer: pdfBuffer };
  }

  async updateUserLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const locationData = {
      currentLatitude: latitude,
      currentLongitude: longitude,
      lastLocationUpdate: new Date(),
    };
    await this.tenantUserRepo.update(userId, locationData);
    const publicUserRepo = await this.getPublicUserRepo();
    await publicUserRepo.update(userId, locationData);

    const activeRequest = await this.requestRepo.findOne({
      where: [
        {
          userId,
          status: ServiceRequestStatus.ON_THE_WAY,
        },
        {
          assignedTechnicianId: userId,
          status: ServiceRequestStatus.ON_THE_WAY,
        },
        {
          userId,
          status: ServiceRequestStatus.IN_PROGRESS,
        },
        {
          assignedTechnicianId: userId,
          status: ServiceRequestStatus.IN_PROGRESS,
        },
      ],
      select: [
        'id',
        'userId',
        'assignedTechnicianId',
        'status',
        'latitude',
        'longitude',
      ],
      relations: [],
    });

    if (!activeRequest) return;

    const isClient = activeRequest.userId === userId;
    this.gateway.emitLocationUpdated(activeRequest.id, {
      userId,
      role: isClient ? 'client' : 'technician',
      latitude,
      longitude,
    });

    if (activeRequest.status === ServiceRequestStatus.ON_THE_WAY) {
      const client = await this.tenantUserRepo.findOne({
        where: { id: activeRequest.userId },
        select: ['id', 'currentLatitude', 'currentLongitude'],
      });
      const technician = await this.tenantUserRepo.findOne({
        where: { id: activeRequest.assignedTechnicianId ?? '' },
        select: ['id', 'currentLatitude', 'currentLongitude'],
      });

      const clientLat = client?.currentLatitude ?? activeRequest.latitude;
      const clientLng = client?.currentLongitude ?? activeRequest.longitude;
      const techLat = technician?.currentLatitude ?? null;
      const techLng = technician?.currentLongitude ?? null;

      if (techLat !== null && techLng !== null) {
        const distance = this.haversineDistance(
          clientLat,
          clientLng,
          techLat,
          techLng,
        );

        if (distance <= 100) {
          await this.requestRepo.update(activeRequest.id, {
            status: ServiceRequestStatus.IN_PROGRESS,
            startedAt: new Date(),
          });

          const event = this.eventRepo.create({
            serviceRequestId: activeRequest.id,
            previousStatus: ServiceRequestStatus.ON_THE_WAY,
            newStatus: ServiceRequestStatus.IN_PROGRESS,
            triggeredBy: userId,
            metadata: {
              action: 'PROXIMITY_TRIGGERED',
              distanceMeters: distance,
            },
          });
          await this.eventRepo.save(event);

          this.gateway.emitServiceStatusUpdated(
            activeRequest.id,
            ServiceRequestStatus.IN_PROGRESS,
          );
        }
      }
    }
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async findByIdOrThrow(
    serviceRequestId: string,
  ): Promise<ServiceRequestResponseDto> {
    const request = await this.requestRepo.findOne({
      where: { id: serviceRequestId },
      relations: ['technicianResponses', 'assignedTechnician'],
    });

    if (!request) {
      throw new NotFoundException(
        `Service request with ID ${serviceRequestId} not found`,
      );
    }

    return this.toResponse(request);
  }

  private normalizeSkills(skills: string[]): string[] {
    const normalized = skills
      .map((skill) => skill.trim().toLowerCase())
      .filter((skill) => skill.length > 0);

    return [...new Set(normalized)];
  }

  private async ensureTenantUserProjection(user: DbUserEntity): Promise<void> {
    const existing = await this.tenantUserRepo.findOne({
      where: { id: user.id },
      select: ['id'],
    });

    if (existing) {
      return;
    }

    const projection = this.tenantUserRepo.create({
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      documentId: user.documentId,
      profilePhotoUrl: user.profilePhotoUrl,
      skills: user.skills ?? [],
      currentLatitude: user.currentLatitude,
      currentLongitude: user.currentLongitude,
      lastLocationUpdate: user.lastLocationUpdate,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      primaryRole: user.primaryRole,
      lastLoginAt: user.lastLoginAt,
      deletedAt: user.deletedAt,
    });

    await this.tenantUserRepo.save(projection);
  }

  private async classifyProblemWithAgent(problema: string): Promise<{
    skills: string[];
    urgency: UrgencyLevel;
  }> {
    const endpoint = this.configService.get<string>('azureAgent.endpoint');
    const apiKey = this.configService.get<string>('azureAgent.apiKey');
    const apiVersion = this.configService.get<string>('azureAgent.apiVersion');

    if (!endpoint || !apiKey) {
      throw new InternalServerErrorException(
        'Azure agent configuration is missing. Set AZURE_AGENT_ENDPOINT and AZURE_AGENT_API_KEY.',
      );
    }

    const normalizedEndpoint = endpoint.includes('api-version=')
      ? endpoint
      : `${endpoint}${endpoint.includes('?') ? '&' : '?'}api-version=${apiVersion}`;

    let response: Response;
    try {
      response = await fetch(normalizedEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content:
                'Eres un sistema de clasificación para la aplicación CameYo en Colombia. Debes analizar el problema descrito por un usuario y responder únicamente en JSON válido con este esquema EXACTO: { "categoria": "plomeria | electricidad | cerrajeria | gas | albanileria | carpinteria | refrigeracion | tecnologia | jardineria | pintura | limpieza | impermeabilizacion | techos | vidrieria | soldadura | mantenimiento | mascotas | mudanza | otro", "urgencia": "baja | media | alta"} Reglas estrictas: - SOLO puedes usar exactamente uno de los valores indicados en "categoria". - No puedes inventar nuevas categorías. - No puedes cambiar la ortografía. - No puedes usar acentos. - Si no encaja claramente en ninguna, usa "otro". - Si hay riesgo inmediato (inundación, fuga de gas, corto circuito, persona atrapada), la urgencia es "alta". - Si el usuario expresa prisa ("urgente", "ya", "ahora mismo"), es "alta". - Si el problema impide usar algo esencial (sin agua, sin luz), es mínimo "media". - No agregues texto fuera del JSON.',
            },
            {
              role: 'user',
              content: `Problema: ${problema}`,
            },
          ],
          temperature: 0,
          response_format: {
            type: 'json_object',
          },
        }),
      });
    } catch (error) {
      this.logger.error('Azure agent request failed', error);
      throw new InternalServerErrorException(
        'Failed to contact Azure agent service',
      );
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Azure agent responded with status ${response.status}: ${body}`,
      );
      throw new InternalServerErrorException(
        'Azure agent service returned an error',
      );
    }

    const completion = (await response.json()) as ChatCompletionsResponse;
    const rawContent = completion.choices?.[0]?.message?.content;
    const content = this.extractAssistantContent(rawContent);

    if (!content) {
      throw new InternalServerErrorException(
        'Azure agent response did not include assistant content',
      );
    }

    let payload: AgentClassificationResponse;
    try {
      payload = JSON.parse(content) as AgentClassificationResponse;
    } catch {
      this.logger.error(`Azure agent returned non-JSON content: ${content}`);
      throw new InternalServerErrorException(
        'Azure agent response is not valid JSON',
      );
    }

    const rawCategory = payload.categoria ?? payload.categoría;
    const skills = this.parseCategoryToSkills(rawCategory);
    const urgency = this.mapUrgency(payload.urgencia);

    if (skills.length === 0) {
      throw new InternalServerErrorException(
        'Azure agent response did not include a valid categoria',
      );
    }

    return {
      skills,
      urgency,
    };
  }

  private parseCategoryToSkills(rawCategory: unknown): string[] {
    if (typeof rawCategory === 'string') {
      return this.normalizeSkills([rawCategory]);
    }

    if (Array.isArray(rawCategory)) {
      return this.normalizeSkills(
        rawCategory.filter(
          (value): value is string => typeof value === 'string',
        ),
      );
    }

    return [];
  }

  private extractAssistantContent(
    content:
      | string
      | Array<{
          type?: string;
          text?: string;
        }>
      | undefined,
  ): string {
    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('')
        .trim();
    }

    return '';
  }

  private mapUrgency(rawUrgency: unknown): UrgencyLevel {
    if (typeof rawUrgency !== 'string') {
      return UrgencyLevel.media;
    }

    const value = rawUrgency.trim().toLowerCase();

    if (value === 'baja' || value === 'low') {
      return UrgencyLevel.baja;
    }

    if (value === 'media' || value === 'medium') {
      return UrgencyLevel.media;
    }

    if (value === 'alta' || value === 'high') {
      return UrgencyLevel.alta;
    }

    return UrgencyLevel.media;
  }

  private toResponse(request: {
    id: string;
    userId: string;
    assignedTechnicianId: string | null;
    rawDescription: string;
    serviceCity: string;
    requestedSkills: string[];
    status: ServiceRequestStatus;
    urgency: UrgencyLevel;
    latitude: number;
    longitude: number;
    addressText: string;
    startedAt?: Date | null;
    completedAt?: Date | null;
    clientMarkedComplete?: boolean;
    technicianMarkedComplete?: boolean;
    displacementDistanceKm?: number | null;
    finalPrice?: string | null;
    receiptUrl?: string | null;
    isRated?: boolean;
    assignedTechnician?: {
      fullName: string;
      profilePhotoUrl?: string | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
    technicianResponses: {
      technicianUserId: string;
      status: TechnicianResponseStatus;
      respondedAt: Date;
    }[];
  }): ServiceRequestResponseDto {
    const response = new ServiceRequestResponseDto();
    response.id = request.id;
    response.userId = request.userId;
    response.assignedTechnicianId = request.assignedTechnicianId;
    response.problema = request.rawDescription;
    response.requestedSkills = request.requestedSkills;
    response.status = request.status;
    response.urgency = request.urgency;
    response.latitude = request.latitude;
    response.longitude = request.longitude;
    response.addressText = request.addressText;
    response.serviceCity = request.serviceCity;
    response.startedAt = request.startedAt ?? null;
    response.completedAt = request.completedAt ?? null;
    response.clientMarkedComplete = request.clientMarkedComplete ?? false;
    response.technicianMarkedComplete =
      request.technicianMarkedComplete ?? false;
    response.displacementDistanceKm = request.displacementDistanceKm ?? null;
    response.finalPrice = request.finalPrice ?? null;
    response.technicianName = request.assignedTechnician?.fullName ?? null;
    response.technicianPhotoUrl =
      request.assignedTechnician?.profilePhotoUrl ?? null;
    response.receiptUrl = request.receiptUrl ?? null;
    response.isRated = request.isRated ?? false;
    response.categoryName =
      request.requestedSkills.length > 0 ? request.requestedSkills[0] : null;
    response.technicianResponses = request.technicianResponses.map((item) => ({
      technicianUserId: item.technicianUserId,
      status: item.status,
      respondedAt: item.respondedAt,
    }));
    response.createdAt = request.createdAt;
    response.updatedAt = request.updatedAt;
    return response;
  }

  async rateService(
    serviceRequestId: string,
    dto: RateServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    const request = await this.requestRepo.findOne({
      where: { id: serviceRequestId },
      relations: ['assignedTechnician', 'technicianResponses'],
    });

    if (!request) {
      throw new NotFoundException(
        `Service request with ID ${serviceRequestId} not found`,
      );
    }

    if (request.status !== ServiceRequestStatus.COMPLETED) {
      throw new BadRequestException('Only completed services can be rated');
    }

    if (request.isRated) {
      throw new ConflictException('This service has already been rated');
    }

    if (!request.assignedTechnicianId) {
      throw new BadRequestException(
        'Cannot rate a service without an assigned technician',
      );
    }

    await this.requestRepo.update(serviceRequestId, {
      serviceRating: dto.serviceRating,
      clientComment: dto.comment ?? null,
      technicianRatingValue: dto.technicianRating,
      isRated: true,
    });

    const publicDataSource =
      await this.tenantDataSourceService.getDataSource('public');
    const publicProfileRepo = publicDataSource.getRepository(
      ProviderProfileEntity,
    );

    const profile = await publicProfileRepo.findOne({
      where: { userId: request.assignedTechnicianId },
    });

    if (profile) {
      const currentTotal = profile.totalRatings ?? 0;
      const currentAvg = profile.averageRating ?? 0;
      const newTotal = currentTotal + 1;
      const newAvg =
        (currentAvg * currentTotal + dto.technicianRating) / newTotal;

      await publicProfileRepo.update(
        { userId: request.assignedTechnicianId },
        {
          averageRating: newAvg,
          totalRatings: newTotal,
        },
      );
    }

    const updated = await this.requestRepo.findOneOrFail({
      where: { id: serviceRequestId },
      relations: ['assignedTechnician', 'technicianResponses'],
    });

    this.logger.log(`Service request ${serviceRequestId} rated`);
    return this.toResponse(updated);
  }
}
