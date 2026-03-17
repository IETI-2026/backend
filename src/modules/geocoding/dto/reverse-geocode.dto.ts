import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class ReverseGeocodeDto {
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lng!: number;
}
