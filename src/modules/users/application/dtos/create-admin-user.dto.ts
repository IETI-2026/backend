import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { RoleName } from '@/database/enums';
import { CreateUserDto } from './create-user.dto';

export class CreateAdminUserDto extends CreateUserDto {
  @ApiProperty({
    description: 'Rol administrativo a asignar',
    enum: [RoleName.ADMIN, RoleName.MODERATOR],
    example: RoleName.ADMIN,
  })
  @IsIn([RoleName.ADMIN, RoleName.MODERATOR])
  role!: RoleName.ADMIN | RoleName.MODERATOR;
}
