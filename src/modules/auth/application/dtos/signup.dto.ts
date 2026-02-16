import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  fullName?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/mgi, {
    message: 'Password must contain uppercase, lowercase, number and special character (@$!%*?&)',
  })
  password?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
