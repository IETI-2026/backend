import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoleName } from '@/database/enums';
import { Roles } from '../../../auth/infrastructure/decorators';
import { JwtAuthGuard, RolesGuard } from '../../../auth/infrastructure/guards';
import { AdminUsersService } from '../../application';
import { CreateAdminUserDto, UserResponseDto } from '../../application/dtos';

@ApiTags('admin-users')
@Controller('users/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR)
  @ApiOperation({
    summary: 'Crear usuario administrativo',
    description: 'Crea un nuevo usuario con rol ADMIN o MODERATOR',
  })
  @ApiCreatedResponse({
    description: 'Usuario administrativo creado exitosamente',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Datos invalidos o rol no permitido' })
  @ApiForbiddenResponse({ description: 'Requiere rol ADMIN o MODERATOR' })
  @ApiUnauthorizedResponse({ description: 'Token invalido o expirado' })
  async createAdmin(@Body() dto: CreateAdminUserDto): Promise<UserResponseDto> {
    return this.adminUsersService.createAdminUser(dto);
  }
}
