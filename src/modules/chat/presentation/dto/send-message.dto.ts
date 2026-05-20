import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Hola, ya estoy en camino' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content!: string;
}
