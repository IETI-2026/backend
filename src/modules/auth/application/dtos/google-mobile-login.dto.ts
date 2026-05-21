import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleMobileLoginDto {
  @ApiProperty({
    description: 'ID Token emitido por Google Sign-In desde la app móvil',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
