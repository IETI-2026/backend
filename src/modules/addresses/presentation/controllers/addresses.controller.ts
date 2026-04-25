import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtPayloadEntity } from '../../../auth/domain/entities';
import { CurrentUser } from '../../../auth/infrastructure/decorators';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards';
import {
  AddressesService,
  AddressResponseDto,
  CreateAddressDto,
} from '../../application';

@ApiTags('addresses')
@Controller('addresses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Throttle({ default: { ttl: 60, limit: 30 } })
@ApiUnauthorizedResponse({ description: 'Token de acceso inválido o expirado' })
export class AddressesController {
  private readonly logger = new Logger(AddressesController.name);

  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar direcciones del usuario autenticado' })
  findAll(
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<AddressResponseDto[]> {
    if (!user.sub) throw new UnauthorizedException();
    this.logger.log(`GET /addresses - userId=${user.sub}`);
    return this.addressesService.findByUser(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva dirección' })
  create(
    @CurrentUser() user: JwtPayloadEntity,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    if (!user.sub) throw new UnauthorizedException();
    this.logger.log(`POST /addresses - userId=${user.sub}`);
    return this.addressesService.create(user.sub, dto);
  }

  @Patch(':id/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar una dirección como predeterminada' })
  setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<AddressResponseDto> {
    if (!user.sub) throw new UnauthorizedException();
    this.logger.log(`PATCH /addresses/${id}/default - userId=${user.sub}`);
    return this.addressesService.setDefault(id, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una dirección' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayloadEntity,
  ): Promise<void> {
    if (!user.sub) throw new UnauthorizedException();
    this.logger.log(`DELETE /addresses/${id} - userId=${user.sub}`);
    return this.addressesService.remove(id, user.sub);
  }
}
