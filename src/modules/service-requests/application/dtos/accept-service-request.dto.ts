import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AcceptServiceRequestDto {
  @ApiProperty({
    description: 'ID del usuario técnico que acepta la solicitud',
    example: 'd94f7f76-7f57-45be-8a0f-47f6385ab81e',
  })
  @IsUUID()
  technicianUserId!: string;
}
