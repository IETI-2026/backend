import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID } from 'class-validator';

export class MarkCompleteDto {
  @ApiProperty({
    description: 'ID del usuario que marca como finalizado',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Rol del usuario que marca como finalizado',
    enum: ['client', 'technician'],
    example: 'client',
  })
  @IsString()
  @IsIn(['client', 'technician'])
  role!: 'client' | 'technician';
}
