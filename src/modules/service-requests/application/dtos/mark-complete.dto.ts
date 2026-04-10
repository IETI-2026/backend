import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class MarkCompleteDto {
  @ApiProperty({
    description: 'Rol del usuario que marca como finalizado',
    enum: ['client', 'technician'],
    example: 'client',
  })
  @IsString()
  @IsIn(['client', 'technician'])
  role!: 'client' | 'technician';
}
