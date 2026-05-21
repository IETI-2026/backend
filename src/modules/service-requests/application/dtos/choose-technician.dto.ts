import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ChooseTechnicianDto {
  @ApiProperty({
    description: 'ID del técnico elegido por el cliente',
    example: 'd94f7f76-7f57-45be-8a0f-47f6385ab81e',
  })
  @IsUUID()
  technicianUserId!: string;
}
