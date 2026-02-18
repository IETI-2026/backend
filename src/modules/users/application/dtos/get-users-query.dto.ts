import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@users/domain';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página (empieza en 0)',
    example: 0,
    minimum: 0,
    default: 0,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  page?: number = 0;

  @ApiPropertyOptional({
    description: 'Cantidad de usuarios por página',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filtrar por estado del usuario',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
