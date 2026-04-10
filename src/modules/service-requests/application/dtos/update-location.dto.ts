import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdateLocationDto {
  @ApiProperty({ description: 'Latitud actual', example: 4.60971 })
  @IsNumber()
  latitude!: number;

  @ApiProperty({ description: 'Longitud actual', example: -74.08175 })
  @IsNumber()
  longitude!: number;
}
