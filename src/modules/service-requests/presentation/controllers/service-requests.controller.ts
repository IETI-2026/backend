import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  AcceptedTechnicianUserDto,
  AcceptServiceRequestDto,
  ChooseTechnicianDto,
  CreateServiceRequestDto,
  GetServiceRequestsQueryDto,
  RejectServiceRequestDto,
  ServiceRequestResponseDto,
  ServiceRequestsService,
} from "../../application";
import { JwtAuthGuard } from "../../../auth/infrastructure/guards/jwt-auth.guard";

@ApiTags("service-requests")
@Controller("service-requests")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Token de acceso inválido o expirado" })
export class ServiceRequestsController {
  private readonly logger = new Logger(ServiceRequestsController.name);

  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Listar todas las solicitudes",
    description:
      "Retorna solicitudes de servicio incluyendo las asignadas, con filtros opcionales y paginación",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: [
      "REQUESTED",
      "ASSIGNED",
      "ON_THE_WAY",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "FAILED",
    ],
  })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "technicianUserId", required: false, type: String })
  @ApiQuery({ name: "serviceCity", required: false, type: String })
  @ApiQuery({ name: "page", required: false, type: Number, example: 0 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiOkResponse({
    description: "Solicitudes obtenidas exitosamente",
    schema: {
      type: "object",
      properties: {
        requests: {
          type: "array",
          items: { $ref: "#/components/schemas/ServiceRequestResponseDto" },
        },
        total: { type: "number", example: 10 },
        page: { type: "number", example: 0 },
        limit: { type: "number", example: 20 },
      },
    },
  })
  async findAll(@Query() query: GetServiceRequestsQueryDto): Promise<{
    requests: ServiceRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.log("GET /service-requests - Listing all requests");
    return await this.serviceRequestsService.findAll(query);
  }

  @Get(":id/accepted-technicians")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Listar técnicos que aceptaron",
    description:
      "Retorna todos los usuarios técnicos que aceptaron una solicitud de servicio",
  })
  @ApiParam({
    name: "id",
    type: "string",
    description: "ID de la solicitud de servicio",
  })
  @ApiOkResponse({
    description: "Técnicos aceptados obtenidos exitosamente",
    type: AcceptedTechnicianUserDto,
    isArray: true,
  })
  @ApiNotFoundResponse({
    description: "Solicitud no encontrada",
  })
  async findAcceptedTechnicians(
    @Param("id") id: string,
  ): Promise<AcceptedTechnicianUserDto[]> {
    this.logger.log(
      `GET /service-requests/${id}/accepted-technicians - Listing accepted technicians`,
    );

    return await this.serviceRequestsService.findAcceptedTechnicians(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Crear solicitud de servicio",
    description:
      "Crea una solicitud y usa IA para inferir habilidades requeridas y urgencia a partir del problema",
  })
  @ApiCreatedResponse({
    description: "Solicitud creada exitosamente",
    type: ServiceRequestResponseDto,
  })
  @ApiBadRequestResponse({ description: "Datos de entrada inválidos" })
  @ApiNotFoundResponse({ description: "Usuario cliente no encontrado" })
  async create(
    @Body() createServiceRequestDto: CreateServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    this.logger.log("POST /service-requests - Creating service request");
    return await this.serviceRequestsService.create(createServiceRequestDto);
  }

  @Get("available/:technicianUserId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Listar solicitudes disponibles para técnico",
    description:
      "Retorna solicitudes REQUESTED que comparten al menos una habilidad con el técnico",
  })
  @ApiParam({
    name: "technicianUserId",
    type: "string",
    description: "ID del usuario técnico",
  })
  @ApiOkResponse({
    description: "Solicitudes disponibles obtenidas exitosamente",
    type: ServiceRequestResponseDto,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: "Técnico no encontrado" })
  async findAvailableForTechnician(
    @Param("technicianUserId") technicianUserId: string,
  ): Promise<ServiceRequestResponseDto[]> {
    this.logger.log(
      `GET /service-requests/available/${technicianUserId} - Fetching available requests`,
    );

    return await this.serviceRequestsService.findAvailableForTechnician(
      technicianUserId,
    );
  }

  @Patch(":id/accept")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Aceptar solicitud de servicio",
    description:
      "Permite a un técnico aceptar una solicitud en estado REQUESTED. La asignación final la hace el cliente.",
  })
  @ApiParam({
    name: "id",
    type: "string",
    description: "ID de la solicitud de servicio",
  })
  @ApiOkResponse({
    description: "Respuesta del técnico registrada exitosamente",
    type: ServiceRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Solicitud o técnico no encontrado",
  })
  @ApiConflictResponse({
    description: "La solicitud ya no está disponible para responder",
  })
  async accept(
    @Param("id") id: string,
    @Body() acceptServiceRequestDto: AcceptServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    this.logger.log(`PATCH /service-requests/${id}/accept - Accepting request`);
    return await this.serviceRequestsService.accept(
      id,
      acceptServiceRequestDto,
    );
  }

  @Patch(":id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rechazar solicitud de servicio",
    description:
      "Permite a un técnico rechazar una solicitud REQUESTED y registrar su respuesta",
  })
  @ApiParam({
    name: "id",
    type: "string",
    description: "ID de la solicitud de servicio",
  })
  @ApiOkResponse({
    description: "Rechazo registrado exitosamente",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example:
            "Service request 6f9619ff-8b86-d011-b42d-00cf4fc964ff rejected by technician d94f7f76-7f57-45be-8a0f-47f6385ab81e",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Solicitud o técnico no encontrado",
  })
  @ApiConflictResponse({
    description: "La solicitud no se puede rechazar en su estado actual",
  })
  async reject(
    @Param("id") id: string,
    @Body() rejectServiceRequestDto: RejectServiceRequestDto,
  ): Promise<{ message: string }> {
    this.logger.log(`PATCH /service-requests/${id}/reject - Rejecting request`);
    return await this.serviceRequestsService.reject(
      id,
      rejectServiceRequestDto,
    );
  }

  @Patch(":id/choose-technician")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Cliente elige técnico",
    description:
      "Permite al cliente elegir uno de los técnicos que aceptaron la solicitud",
  })
  @ApiParam({
    name: "id",
    type: "string",
    description: "ID de la solicitud de servicio",
  })
  @ApiOkResponse({
    description: "Técnico elegido y solicitud asignada exitosamente",
    type: ServiceRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Solicitud no encontrada",
  })
  @ApiConflictResponse({
    description:
      "El cliente no es dueño de la solicitud, el técnico no aceptó o el estado no permite asignar",
  })
  async chooseTechnician(
    @Param("id") id: string,
    @Body() chooseTechnicianDto: ChooseTechnicianDto,
  ): Promise<ServiceRequestResponseDto> {
    this.logger.log(
      `PATCH /service-requests/${id}/choose-technician - Choosing technician`,
    );
    return await this.serviceRequestsService.chooseTechnician(
      id,
      chooseTechnicianDto,
    );
  }
}
