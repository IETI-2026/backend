export class AddressResponseDto {
  id!: string;
  userId!: string;
  street!: string;
  city!: string;
  neighborhood!: string | null;
  department!: string | null;
  country!: string;
  postalCode!: string | null;
  label!: string | null;
  latitude!: number | null;
  longitude!: number | null;
  isDefault!: boolean;
  createdAt!: Date;
}
