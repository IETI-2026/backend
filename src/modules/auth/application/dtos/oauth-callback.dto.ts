import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class OAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code?: string;

  @IsString()
  @IsNotEmpty()
  state?: string;

  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @IsString()
  fullName?: string;

  @IsString()
  profilePhotoUrl?: string;
}
