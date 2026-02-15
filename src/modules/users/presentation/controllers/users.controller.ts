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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateUserDto,
  GetUsersQueryDto,
  UpdateUserDto,
  UserResponseDto,
} from '@users/application';
import { UsersService } from '@users/application';

@ApiTags('users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear nuevo usuario',
    description:
      'Crea un nuevo usuario en el sistema con los datos proporcionados',
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
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.log('POST /users - Creating new user');
    return await this.usersService.create(createUserDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar usuarios',
    description:
      'Obtiene una lista paginada de usuarios con filtros opcionales',
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
  async findAll(@Query() query: GetUsersQueryDto): Promise<{
    users: UserResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.log('GET /users - Fetching all users');
    return await this.usersService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description: 'Obtiene los datos de un usuario específico mediante su ID',
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
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    this.logger.log(`GET /users/${id} - Fetching user by ID`);
    return await this.usersService.findOne(id);
  }

  @Get('email/:email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Buscar usuario por email',
    description: 'Busca un usuario específico mediante su dirección de email',
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
  async findByEmail(@Param('email') email: string): Promise<UserResponseDto> {
    this.logger.log(`GET /users/email/${email} - Fetching user by email`);
    return await this.usersService.findByEmail(email);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar usuario',
    description: 'Actualiza los datos de un usuario existente',
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
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`PATCH /users/${id} - Updating user`);
    return await this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar usuario (soft delete)',
    description:
      'Marca el usuario como eliminado sin borrarlo permanentemente de la base de datos',
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
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.log(`DELETE /users/${id} - Soft deleting user`);
    return await this.usersService.remove(id);
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar usuario permanentemente (hard delete)',
    description:
      '⚠️ PELIGRO: Elimina el usuario permanentemente de la base de datos. Esta acción no se puede deshacer.',
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
  async hardDelete(@Param('id') id: string): Promise<void> {
    this.logger.log(`DELETE /users/${id}/hard - Hard deleting user`);
    return await this.usersService.hardDelete(id);
  }
}
