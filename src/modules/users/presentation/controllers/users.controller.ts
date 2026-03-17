import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CreateUserDto,
  GetUsersQueryDto,
  UpdateProfileDto,
  UpdateUserDto,
  UserResponseDto,
  UsersService,
} from '@users/application';
import { RoleName } from '@/database/enums';
import { JwtPayloadEntity } from '../../../auth/domain/entities';
import { CurrentUser, Roles } from '../../../auth/infrastructure/decorators';
import { JwtAuthGuard, RolesGuard } from '../../../auth/infrastructure/guards';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // 🔒 Proteger todo el controlador
@ApiBearerAuth() // 📝 Documentar que requiere autenticación
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR) // 🔐 Solo admins pueden crear usuarios
  @ApiOperation({
    summary: 'Crear nuevo usuario',
    description:
      'Crea un nuevo usuario en el sistema con los datos proporcionados (Solo Admin/Moderador)',
  })
  @ApiCreatedResponse({
    description: 'Usuario creado exitosamente',
    type: 'UserResponseDto',
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos',
  })
  @ApiConflictResponse({
    description: 'El email, teléfono o documento ya está en uso',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado - Se requiere rol Admin o Moderador',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso inválido o expirado',
  })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: JwtPayloadEntity,
  ): Promise<UserResponseDto> {
    this.logger.log(`POST /users - Creating new user by ${currentUser.email}`);
    return await this.usersService.create(createUserDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR) // 🔐 Solo admins pueden listar todos los usuarios
  @ApiOperation({
    summary: 'Listar usuarios',
    description:
      'Obtiene una lista paginada de usuarios con filtros opcionales (Solo Admin/Moderador)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página (empieza en 0)',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Cantidad de usuarios por página',
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'],
    description: 'Filtrar por estado del usuario',
  })
  @ApiOkResponse({
    description: 'Lista de usuarios obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: { type: 'object' },
        },
        total: { type: 'number', example: 100 },
        page: { type: 'number', example: 0 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado - Se requiere rol Admin o Moderador',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso inválido o expirado',
  })
  async findAll(
    @Query() query: GetUsersQueryDto,
    @CurrentUser() currentUser: JwtPayloadEntity,
  ): Promise<{
    users: UserResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.log(`GET /users - Fetching all users by ${currentUser.email}`);
    return await this.usersService.findAll(query);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener mi perfil',
    description:
      'Obtiene los datos del usuario autenticado (alias de GET /api/auth/me con formato de recurso users)',
  })
  @ApiOkResponse({
    description: 'Perfil del usuario actual',
    type: 'UserResponseDto',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso inválido o expirado',
  })
  async getMe(
    @CurrentUser() currentUser: JwtPayloadEntity,
  ): Promise<UserResponseDto> {
    if (!currentUser.sub)
      throw new UnauthorizedException('User ID not available');
    this.logger.log(
      `GET /users/me - Fetching own profile by ${currentUser.email}`,
    );
    return await this.usersService.findOne(currentUser.sub);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar mi perfil',
    description:
      'Actualiza los datos del usuario autenticado (solo fullName, phoneNumber, profilePhotoUrl)',
  })
  @ApiOkResponse({
    description: 'Perfil actualizado exitosamente',
    type: 'UserResponseDto',
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos',
  })
  @ApiConflictResponse({
    description: 'El teléfono ya está en uso por otro usuario',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso inválido o expirado',
  })
  async updateMe(
    @CurrentUser() currentUser: JwtPayloadEntity,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    this.logger.log(
      `PATCH /users/me - Updating own profile by ${currentUser.email}`,
    );
    if (!currentUser.sub)
      throw new UnauthorizedException('User ID not available');
    return await this.usersService.updateProfile(
      currentUser.sub,
      updateProfileDto,
    );
  }

  @Get('email/:email')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR) // 🔐 Solo admins
  @ApiOperation({
    summary: 'Buscar usuario por email',
    description:
      'Busca un usuario específico mediante su dirección de email (Solo Admin/Moderador)',
  })
  @ApiParam({
    name: 'email',
    type: 'string',
    description: 'Email del usuario',
    example: 'usuario@example.com',
  })
  @ApiOkResponse({
    description: 'Usuario encontrado',
    type: 'UserResponseDto',
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado con ese email',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado - Se requiere rol Admin o Moderador',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso inválido o expirado',
  })
  async findByEmail(
    @Param('email') email: string,
    @CurrentUser() currentUser: JwtPayloadEntity,
  ): Promise<UserResponseDto> {
    this.logger.log(
      `GET /users/email/${email} - Fetching user by email by ${currentUser.email}`,
    );
    return await this.usersService.findByEmail(email);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR) // 🔐 Solo admins o el propio usuario
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description:
      'Obtiene los datos de un usuario específico mediante su ID (Solo Admin/Moderador)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'ID único del usuario (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Usuario encontrado',
    type: 'UserResponseDto',
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado - Se requiere rol Admin o Moderador',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso inválido o expirado',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayloadEntity,
  ): Promise<UserResponseDto> {
    this.logger.log(
      `GET /users/${id} - Fetching user by ID by ${currentUser.email}`,
    );
    return await this.usersService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.MODERATOR) // 🔐 Solo admins o el propio usuario
  @ApiOperation({
    summary: 'Actualizar usuario',
    description:
      'Actualiza los datos de un usuario existente (Solo Admin/Moderador)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'ID único del usuario (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Usuario actualizado exitosamente',
    type: 'UserResponseDto',
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado',
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos',
  })
  @ApiConflictResponse({
    description: 'El email o teléfono ya está en uso por otro usuario',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado - Se requiere rol Admin o Moderador',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso inválido o expirado',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: JwtPayloadEntity,
  ): Promise<UserResponseDto> {
    this.logger.log(
      `PATCH /users/${id} - Updating user by ${currentUser.email}`,
    );
    return await this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RoleName.ADMIN) // 🔐 Solo admins pueden eliminar
  @ApiOperation({
    summary: 'Eliminar usuario (soft delete)',
    description:
      'Marca el usuario como eliminado sin borrarlo permanentemente de la base de datos (Solo Admin)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'ID único del usuario (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiNoContentResponse({
    description: 'Usuario eliminado exitosamente (soft delete)',
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado - Se requiere rol Admin',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso inválido o expirado',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayloadEntity,
  ): Promise<void> {
    this.logger.log(
      `DELETE /users/${id} - Soft deleting user by ${currentUser.email}`,
    );
    return await this.usersService.remove(id);
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RoleName.ADMIN) // 🔐 Solo admins pueden hacer hard delete
  @ApiOperation({
    summary: 'Eliminar usuario permanentemente (hard delete)',
    description:
      '⚠️ PELIGRO: Elimina el usuario permanentemente de la base de datos. Esta acción no se puede deshacer. (Solo Admin)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'ID único del usuario (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiNoContentResponse({
    description: 'Usuario eliminado permanentemente',
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado - Se requiere rol Admin',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso inválido o expirado',
  })
  async hardDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayloadEntity,
  ): Promise<void> {
    this.logger.log(
      `DELETE /users/${id}/hard - Hard deleting user by ${currentUser.email}`,
    );
    return await this.usersService.hardDelete(id);
  }
}
