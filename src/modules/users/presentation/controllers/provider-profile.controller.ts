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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtPayloadEntity } from '../../../auth/domain/entities';
import { CurrentUser, Roles } from '../../../auth/infrastructure/decorators';
import { JwtAuthGuard, RolesGuard } from '../../../auth/infrastructure/guards';
import {
  CreateProviderProfileDto,
  ProviderProfileResponseDto,
  UpdateProviderProfileDto,
  VerifyProviderDto,
} from '../../application/dtos';
import { ProviderProfileService } from '../../application/use-cases/provider-profile.service';

@ApiTags('provider-profile')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acceso inválido o expirado' })
export class ProviderProfileController {
  private readonly logger = new Logger(ProviderProfileController.name);

  constructor(
    private readonly providerProfileService: ProviderProfileService,
  ) {}

  @Post('me/provider-profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrarse como prestador',
    description:
      'Crea el perfil de prestador para el usuario autenticado y le asigna el rol PROVIDER',
  })
  @ApiCreatedResponse({
    description: 'Perfil de prestador creado',
    type: ProviderProfileResponseDto,
  })
  @ApiConflictResponse({
    description: 'Ya existe un perfil de prestador para este usuario',
  })
  async createMyProfile(
    @CurrentUser() user: JwtPayloadEntity,
    @Body() dto: CreateProviderProfileDto,
  ): Promise<ProviderProfileResponseDto> {
    if (!user.sub) throw new UnauthorizedException('User ID not available');
    this.logger.log(`POST /users/me/provider-profile by ${user.email}`);
    return this.providerProfileService.create(user.sub, dto);
  }

  @Get('me/provider-profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener mi perfil de prestador' })
  @ApiOkResponse({ type: ProviderProfileResponseDto })
  @ApiNotFoundResponse({ description: 'No tiene perfil de prestador' })
  async getMyProfile(
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<ProviderProfileResponseDto> {
    if (!user.sub) throw new UnauthorizedException('User ID not available');
    this.logger.log(`GET /users/me/provider-profile by ${user.email}`);
    return this.providerProfileService.findByUserId(user.sub);
  }

  @Patch('me/provider-profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar mi perfil de prestador' })
  @ApiOkResponse({ type: ProviderProfileResponseDto })
  @ApiNotFoundResponse({ description: 'No tiene perfil de prestador' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  async updateMyProfile(
    @CurrentUser() user: JwtPayloadEntity,
    @Body() dto: UpdateProviderProfileDto,
  ): Promise<ProviderProfileResponseDto> {
    if (!user.sub) throw new UnauthorizedException('User ID not available');
    this.logger.log(`PATCH /users/me/provider-profile by ${user.email}`);
    return this.providerProfileService.update(user.sub, dto);
  }

  @Get(':id/provider-profile')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary: 'Ver perfil de prestador de un usuario (Admin/Moderador)',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiOkResponse({ type: ProviderProfileResponseDto })
  @ApiNotFoundResponse({ description: 'Perfil de prestador no encontrado' })
  @ApiForbiddenResponse({ description: 'Requiere rol Admin o Moderador' })
  async getProviderProfile(
    @Param('id') userId: string,
  ): Promise<ProviderProfileResponseDto> {
    this.logger.log(`GET /users/${userId}/provider-profile (admin)`);
    return this.providerProfileService.findByUserId(userId);
  }

  @Patch(':id/verify-provider')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary: 'Verificar/rechazar/suspender prestador (Admin/Moderador)',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario prestador' })
  @ApiOkResponse({ type: ProviderProfileResponseDto })
  @ApiNotFoundResponse({ description: 'Perfil de prestador no encontrado' })
  @ApiForbiddenResponse({ description: 'Requiere rol Admin o Moderador' })
  async verifyProvider(
    @Param('id') userId: string,
    @Body() dto: VerifyProviderDto,
  ): Promise<ProviderProfileResponseDto> {
    this.logger.log(
      `PATCH /users/${userId}/verify-provider action=${dto.action}`,
    );
    return this.providerProfileService.verifyProvider(userId, dto.action);
  }
}
