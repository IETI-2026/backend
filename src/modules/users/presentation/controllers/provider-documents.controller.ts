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
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoleName } from '@/database/enums';
import { JwtPayloadEntity } from '../../../auth/domain/entities';
import { CurrentUser, Roles } from '../../../auth/infrastructure/decorators';
import { JwtAuthGuard, RolesGuard } from '../../../auth/infrastructure/guards';
import {
  DecideProviderDocumentDto,
  ProviderDocumentResponseDto,
  ProviderReviewItemDto,
  ProviderReviewQueryDto,
  UploadProviderDocumentDto,
} from '../../application/dtos';
import { ProviderDocumentsService } from '../../application/use-cases/provider-documents.service';

@ApiTags('provider-documents')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acceso invalido o expirado' })
export class ProviderDocumentsController {
  private readonly logger = new Logger(ProviderDocumentsController.name);

  constructor(
    private readonly providerDocumentsService: ProviderDocumentsService,
  ) {}

  @Post('me/provider-profile/documents')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleName.PROVIDER, RoleName.ADMIN, RoleName.MODERATOR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Cargar documento para revision de proveedor',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', example: 'CERTIFICADO_ANTECEDENTES' },
        issuedAt: { type: 'string', format: 'date-time' },
        expiresAt: { type: 'string', format: 'date-time' },
        documentNumber: { type: 'string', example: '1234567890' },
      },
      required: ['file', 'documentType'],
    },
  })
  @ApiOkResponse({ type: ProviderDocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Archivo o payload invalido' })
  async uploadMyProviderDocument(
    @CurrentUser() user: JwtPayloadEntity,
    @UploadedFile() file: unknown,
    @Body() dto: UploadProviderDocumentDto,
  ): Promise<
    ProviderDocumentResponseDto & { extractedDocumentNumber: string | null }
  > {
    if (!user.sub) throw new UnauthorizedException('User ID not available');

    this.logger.log(
      `POST /users/me/provider-profile/documents by ${user.email}`,
    );

    return this.providerDocumentsService.uploadMyDocument(
      user.sub,
      dto,
      file as {
        originalname: string;
        mimetype: string;
        size: number;
        buffer?: Buffer;
      },
    );
  }

  @Get('admin/provider-review-queue')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({ summary: 'Listar cola de revision documental' })
  @ApiOkResponse({ type: ProviderReviewItemDto, isArray: true })
  @ApiForbiddenResponse({ description: 'Requiere rol ADMIN o MODERATOR' })
  async listReviewQueue(@Query() query: ProviderReviewQueryDto): Promise<{
    items: ProviderReviewItemDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.providerDocumentsService.listReviewQueue(query);
  }

  @Get(':id/provider-documents')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({ summary: 'Listar documentos de un proveedor' })
  @ApiParam({ name: 'id', description: 'ID del usuario proveedor' })
  @ApiOkResponse({ type: ProviderDocumentResponseDto, isArray: true })
  async listProviderDocuments(
    @Param('id') providerUserId: string,
  ): Promise<ProviderDocumentResponseDto[]> {
    return this.providerDocumentsService.listProviderDocuments(providerUserId);
  }

  @Patch(':id/provider-documents/:documentId/decision')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary: 'Aprobar o rechazar documento de proveedor',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario proveedor' })
  @ApiParam({ name: 'documentId', description: 'ID del documento a decidir' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        document: { $ref: '#/components/schemas/ProviderDocumentResponseDto' },
        provider: { $ref: '#/components/schemas/ProviderProfileResponseDto' },
      },
    },
  })
  async decideDocument(
    @Param('id') providerUserId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() reviewer: JwtPayloadEntity,
    @Body() dto: DecideProviderDocumentDto,
  ): Promise<{
    document: ProviderDocumentResponseDto;
    provider: unknown;
  }> {
    if (!reviewer.sub) throw new UnauthorizedException('User ID not available');

    return this.providerDocumentsService.decideDocument(
      providerUserId,
      documentId,
      reviewer.sub,
      reviewer.roles || [],
      dto,
    );
  }
}
