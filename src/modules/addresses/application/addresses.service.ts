import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AddressEntity } from '@/database/entities';
import { TenantDataSourceService } from '@/tenant';
import { AddressResponseDto, CreateAddressDto } from './dtos';

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(
    private readonly tenantDataSourceService: TenantDataSourceService,
  ) {}

  private async getDs(): Promise<DataSource> {
    return this.tenantDataSourceService.getDataSource('public');
  }

  private async getRepo(): Promise<Repository<AddressEntity>> {
    const ds = await this.getDs();
    return ds.getRepository(AddressEntity);
  }

  async findByUser(userId: string): Promise<AddressResponseDto[]> {
    const repo = await this.getRepo();
    const addresses = await repo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    return addresses.map(this.toDto);
  }

  async create(
    userId: string,
    dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    const repo = await this.getRepo();

    const address = repo.create({
      userId,
      street: dto.street,
      city: dto.city,
      neighborhood: dto.neighborhood ?? null,
      department: dto.department ?? null,
      postalCode: dto.postalCode ?? null,
      label: dto.label ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      isDefault: false,
    });

    const saved = await repo.save(address);
    this.logger.log(`Address created for user ${userId}: ${saved.id}`);
    return this.toDto(saved);
  }

  async setDefault(
    addressId: string,
    userId: string,
  ): Promise<AddressResponseDto> {
    const repo = await this.getRepo();

    const address = await repo.findOne({ where: { id: addressId } });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const ds = await this.getDs();
    await ds.transaction(async (em: EntityManager) => {
      await em.update(AddressEntity, { userId }, { isDefault: false });
      await em.update(AddressEntity, { id: addressId }, { isDefault: true });
    });

    const updated = await repo.findOneOrFail({ where: { id: addressId } });
    this.logger.log(`Address ${addressId} set as default for user ${userId}`);
    return this.toDto(updated);
  }

  async remove(addressId: string, userId: string): Promise<void> {
    const repo = await this.getRepo();

    const address = await repo.findOne({ where: { id: addressId } });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await repo.delete({ id: addressId });
    this.logger.log(`Address ${addressId} deleted for user ${userId}`);
  }

  private toDto(entity: AddressEntity): AddressResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      street: entity.street,
      city: entity.city,
      neighborhood: entity.neighborhood,
      department: entity.department,
      country: entity.country,
      postalCode: entity.postalCode,
      label: entity.label,
      latitude: entity.latitude,
      longitude: entity.longitude,
      isDefault: entity.isDefault,
      createdAt: entity.createdAt,
    };
  }
}
