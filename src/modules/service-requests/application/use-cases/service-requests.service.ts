import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type PrismaClient,
  ServiceRequestStatus,
  TechnicianResponseStatus,
  UrgencyLevel,
} from '@prisma/client';
import { TENANT_PRISMA_CLIENT } from '@/tenant';
import {
  type AcceptedTechnicianUserDto,
  type AcceptServiceRequestDto,
  type ChooseTechnicianDto,
  type CreateServiceRequestDto,
  type GetServiceRequestsQueryDto,
  type RejectServiceRequestDto,
  ServiceRequestResponseDto,
} from '../dtos';

@Injectable()
export class ServiceRequestsService {
  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: PrismaClient,
  ) {}

  async create(
    dto: CreateServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    const request = await this.prisma.serviceRequest.create({
      data: {
        userId: dto.userId,
        rawDescription: dto.problema,
        serviceCity: dto.serviceCity.trim().toLowerCase(),
        requestedSkills: this.normalizeSkills(dto.skills),
        latitude: dto.latitude,
        longitude: dto.longitude,
        addressText: dto.addressText,
        urgency: dto.urgency ?? UrgencyLevel.MEDIUM,
      },
      include: {
        technicianResponses: {
          orderBy: { respondedAt: 'desc' },
        },
      },
    });

    return this.toResponse(request);
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

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.technicianUserId
        ? { assignedTechnicianId: query.technicianUserId }
        : {}),
      ...(serviceCity ? { serviceCity } : {}),
    };

    const [requests, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          technicianResponses: {
            orderBy: { respondedAt: 'desc' },
          },
        },
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);

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
    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: { id: true },
    });

    if (!serviceRequest) {
      throw new NotFoundException(
        `Service request with ID ${serviceRequestId} not found`,
      );
    }

    const responses =
      await this.prisma.serviceRequestTechnicianResponse.findMany({
        where: {
          serviceRequestId,
          status: TechnicianResponseStatus.ACCEPTED,
        },
        orderBy: { respondedAt: 'desc' },
        include: {
          technicianUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              skills: true,
              currentLatitude: true,
              currentLongitude: true,
            },
          },
        },
      });

    return responses.map((response) => ({
      id: response.technicianUser.id,
      fullName: response.technicianUser.fullName,
      email: response.technicianUser.email,
      phoneNumber: response.technicianUser.phoneNumber,
      skills: response.technicianUser.skills,
      currentLatitude: response.technicianUser.currentLatitude,
      currentLongitude: response.technicianUser.currentLongitude,
      respondedAt: response.respondedAt,
    }));
  }

  async findAvailableForTechnician(
    technicianUserId: string,
  ): Promise<ServiceRequestResponseDto[]> {
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianUserId },
      select: { id: true, skills: true },
    });

    if (!technician) {
      throw new NotFoundException(
        `Technician user with ID ${technicianUserId} not found`,
      );
    }

    const normalizedSkills = this.normalizeSkills(technician.skills);

    if (normalizedSkills.length === 0) {
      return [];
    }

    const requests = await this.prisma.serviceRequest.findMany({
      where: {
        status: ServiceRequestStatus.REQUESTED,
        requestedSkills: {
          hasSome: normalizedSkills,
        },
        NOT: {
          technicianResponses: {
            some: {
              technicianUserId,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        technicianResponses: {
          orderBy: { respondedAt: 'desc' },
        },
      },
    });

    return requests.map((request) => this.toResponse(request));
  }

  async accept(
    serviceRequestId: string,
    dto: AcceptServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    const technician = await this.prisma.user.findUnique({
      where: { id: dto.technicianUserId },
      select: { id: true },
    });

    if (!technician) {
      throw new NotFoundException(
        `Technician user with ID ${dto.technicianUserId} not found`,
      );
    }

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: { id: true, status: true },
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

    await this.prisma.serviceRequestTechnicianResponse.upsert({
      where: {
        serviceRequestId_technicianUserId: {
          serviceRequestId,
          technicianUserId: dto.technicianUserId,
        },
      },
      create: {
        serviceRequestId,
        technicianUserId: dto.technicianUserId,
        status: TechnicianResponseStatus.ACCEPTED,
        respondedAt: new Date(),
      },
      update: {
        status: TechnicianResponseStatus.ACCEPTED,
        reason: null,
        respondedAt: new Date(),
      },
    });

    await this.prisma.serviceRequestEvent.create({
      data: {
        serviceRequestId,
        previousStatus: ServiceRequestStatus.REQUESTED,
        newStatus: ServiceRequestStatus.REQUESTED,
        triggeredBy: dto.technicianUserId,
        metadata: {
          action: 'TECHNICIAN_ACCEPTED',
        },
      },
    });

    return this.findByIdOrThrow(serviceRequestId);
  }

  async reject(
    serviceRequestId: string,
    dto: RejectServiceRequestDto,
  ): Promise<{ message: string }> {
    const technician = await this.prisma.user.findUnique({
      where: { id: dto.technicianUserId },
      select: { id: true },
    });

    if (!technician) {
      throw new NotFoundException(
        `Technician user with ID ${dto.technicianUserId} not found`,
      );
    }

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: { id: true, status: true },
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

    await this.prisma.serviceRequestTechnicianResponse.upsert({
      where: {
        serviceRequestId_technicianUserId: {
          serviceRequestId,
          technicianUserId: dto.technicianUserId,
        },
      },
      create: {
        serviceRequestId,
        technicianUserId: dto.technicianUserId,
        status: TechnicianResponseStatus.REJECTED,
        reason: dto.reason ?? null,
        respondedAt: new Date(),
      },
      update: {
        status: TechnicianResponseStatus.REJECTED,
        reason: dto.reason ?? null,
        respondedAt: new Date(),
      },
    });

    await this.prisma.serviceRequestEvent.create({
      data: {
        serviceRequestId,
        previousStatus: ServiceRequestStatus.REQUESTED,
        newStatus: ServiceRequestStatus.REQUESTED,
        triggeredBy: dto.technicianUserId,
        notes: dto.reason ?? null,
        metadata: {
          action: 'TECHNICIAN_REJECTED',
        },
      },
    });

    return {
      message: `Service request ${serviceRequestId} rejected by technician ${dto.technicianUserId}`,
    };
  }

  async chooseTechnician(
    serviceRequestId: string,
    dto: ChooseTechnicianDto,
  ): Promise<ServiceRequestResponseDto> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
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

    const acceptedResponse =
      await this.prisma.serviceRequestTechnicianResponse.findUnique({
        where: {
          serviceRequestId_technicianUserId: {
            serviceRequestId,
            technicianUserId: dto.technicianUserId,
          },
        },
        select: {
          status: true,
        },
      });

    if (
      !acceptedResponse ||
      acceptedResponse.status !== TechnicianResponseStatus.ACCEPTED
    ) {
      throw new ConflictException(
        `Technician ${dto.technicianUserId} has not accepted service request ${serviceRequestId}`,
      );
    }

    await this.prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        assignedTechnicianId: dto.technicianUserId,
        status: ServiceRequestStatus.ASSIGNED,
        assignedAt: new Date(),
      },
    });

    await this.prisma.serviceRequestEvent.create({
      data: {
        serviceRequestId,
        previousStatus: ServiceRequestStatus.REQUESTED,
        newStatus: ServiceRequestStatus.ASSIGNED,
        triggeredBy: dto.customerUserId,
        metadata: {
          action: 'CUSTOMER_SELECTED_TECHNICIAN',
          technicianUserId: dto.technicianUserId,
        },
      },
    });

    return this.findByIdOrThrow(serviceRequestId);
  }

  private async findByIdOrThrow(
    serviceRequestId: string,
  ): Promise<ServiceRequestResponseDto> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        technicianResponses: {
          orderBy: { respondedAt: 'desc' },
        },
      },
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
    response.technicianResponses = request.technicianResponses.map((item) => ({
      technicianUserId: item.technicianUserId,
      status: item.status,
      respondedAt: item.respondedAt,
    }));
    response.createdAt = request.createdAt;
    response.updatedAt = request.updatedAt;
    return response;
  }
}
