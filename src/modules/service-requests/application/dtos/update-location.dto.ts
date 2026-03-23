import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID } from 'class-validator';

export class UpdateLocationDto {
  @ApiProperty({
    description: 'ID del usuario que actualiza su ubicación',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Latitud actual', example: 4.60971 })
  @IsNumber()
  latitude!: number;

  @ApiProperty({ description: 'Longitud actual', example: -74.08175 })
  @IsNumber()
  longitude!: number;
}
