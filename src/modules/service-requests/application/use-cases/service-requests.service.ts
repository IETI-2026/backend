import {
  ConflictException,
  InternalServerErrorException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  type PrismaClient,
  ServiceRequestStatus,
  TechnicianResponseStatus,
  UrgencyLevel,
} from "@prisma/client";
import { TENANT_PRISMA_CLIENT } from "@/tenant";
import {
  type AcceptedTechnicianUserDto,
  type AcceptServiceRequestDto,
  type ChooseTechnicianDto,
  type CreateServiceRequestDto,
  type GetServiceRequestsQueryDto,
  type RejectServiceRequestDto,
  ServiceRequestResponseDto,
} from "../dtos";

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

  constructor(
    @Inject(TENANT_PRISMA_CLIENT)
    private readonly prisma: PrismaClient,
    private readonly configService: ConfigService,
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

    const classification = await this.classifyProblemWithAgent(dto.problema);

    const request = await this.prisma.serviceRequest.create({
      data: {
        userId: dto.userId,
        rawDescription: dto.problema,
        serviceCity: dto.serviceCity.trim().toLowerCase(),
        requestedSkills: classification.skills,
        latitude: dto.latitude,
        longitude: dto.longitude,
        addressText: dto.addressText,
        urgency: classification.urgency,
      },
      include: {
        technicianResponses: {
          orderBy: { respondedAt: "desc" },
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
        orderBy: { createdAt: "desc" },
        include: {
          technicianResponses: {
            orderBy: { respondedAt: "desc" },
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
        orderBy: { respondedAt: "desc" },
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
      orderBy: { createdAt: "desc" },
      include: {
        technicianResponses: {
          orderBy: { respondedAt: "desc" },
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
          action: "TECHNICIAN_ACCEPTED",
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
          action: "TECHNICIAN_REJECTED",
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
          action: "CUSTOMER_SELECTED_TECHNICIAN",
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
          orderBy: { respondedAt: "desc" },
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

  private async classifyProblemWithAgent(problema: string): Promise<{
    skills: string[];
    urgency: UrgencyLevel;
  }> {
    const endpoint = this.configService.get<string>("azureAgent.endpoint");
    const apiKey = this.configService.get<string>("azureAgent.apiKey");
    const apiVersion = this.configService.get<string>("azureAgent.apiVersion");

    if (!endpoint || !apiKey) {
      throw new InternalServerErrorException(
        "Azure agent configuration is missing. Set AZURE_AGENT_ENDPOINT and AZURE_AGENT_API_KEY.",
      );
    }

    const normalizedEndpoint = endpoint.includes("api-version=")
      ? endpoint
      : `${endpoint}${endpoint.includes("?") ? "&" : "?"}api-version=${apiVersion}`;

    let response: Response;
    try {
      response = await fetch(normalizedEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                'Eres un sistema de clasificación para la aplicación CameYo en Colombia. Debes analizar el problema descrito por un usuario y responder únicamente en JSON válido con este esquema EXACTO: { "categoria": "plomeria | electricidad | cerrajeria | gas | albanileria | carpinteria | refrigeracion | tecnologia | jardineria | pintura | limpieza | impermeabilizacion | techos | vidrieria | soldadura | mantenimiento | mascotas | mudanza | otro", "urgencia": "baja | media | alta"} Reglas estrictas: - SOLO puedes usar exactamente uno de los valores indicados en "categoria". - No puedes inventar nuevas categorías. - No puedes cambiar la ortografía. - No puedes usar acentos. - Si no encaja claramente en ninguna, usa "otro". - Si hay riesgo inmediato (inundación, fuga de gas, corto circuito, persona atrapada), la urgencia es "alta". - Si el usuario expresa prisa ("urgente", "ya", "ahora mismo"), es "alta". - Si el problema impide usar algo esencial (sin agua, sin luz), es mínimo "media". - No agregues texto fuera del JSON.',
            },
            {
              role: "user",
              content: `Problema: ${problema}`,
            },
          ],
          temperature: 0,
          response_format: {
            type: "json_object",
          },
        }),
      });
      console.log("response", response);
    } catch (error) {
      this.logger.error("Azure agent request failed", error);
      throw new InternalServerErrorException(
        "Failed to contact Azure agent service",
      );
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Azure agent responded with status ${response.status}: ${body}`,
      );
      throw new InternalServerErrorException(
        "Azure agent service returned an error",
      );
    }

    const completion = (await response.json()) as ChatCompletionsResponse;
    const rawContent = completion.choices?.[0]?.message?.content;
    const content = this.extractAssistantContent(rawContent);

    if (!content) {
      throw new InternalServerErrorException(
        "Azure agent response did not include assistant content",
      );
    }

    let payload: AgentClassificationResponse;
    try {
      payload = JSON.parse(content) as AgentClassificationResponse;
    } catch {
      this.logger.error(`Azure agent returned non-JSON content: ${content}`);
      throw new InternalServerErrorException(
        "Azure agent response is not valid JSON",
      );
    }

    const rawCategory = payload.categoria ?? payload.categoría;
    const skills = this.parseCategoryToSkills(rawCategory);
    const urgency = this.mapUrgency(payload.urgencia);

    if (skills.length === 0) {
      throw new InternalServerErrorException(
        "Azure agent response did not include a valid categoria",
      );
    }

    return {
      skills,
      urgency,
    };
  }

  private parseCategoryToSkills(rawCategory: unknown): string[] {
    if (typeof rawCategory === "string") {
      return this.normalizeSkills([rawCategory]);
    }

    if (Array.isArray(rawCategory)) {
      return this.normalizeSkills(
        rawCategory.filter(
          (value): value is string => typeof value === "string",
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
    if (typeof content === "string") {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim();
    }

    return "";
  }

  private mapUrgency(rawUrgency: unknown): UrgencyLevel {
    if (typeof rawUrgency !== "string") {
      return UrgencyLevel.media;
    }

    const value = rawUrgency.trim().toLowerCase();

    if (value === "baja" || value === "low") {
      return UrgencyLevel.baja;
    }

    if (value === "media" || value === "medium") {
      return UrgencyLevel.media;
    }

    if (value === "alta" || value === "high") {
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
