import { IsNotEmpty, IsString } from 'class-validator';

export class SuggestSkillDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}
