import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SERVICE_CATEGORY_DATA } from '../constants/service-category-data';
import { ServiceCategoryEntity } from '../entities/service-category.entity';

@Injectable()
export class ServiceCategorySeed implements OnModuleInit {
  private readonly logger = new Logger(ServiceCategorySeed.name);

  constructor(
    @InjectRepository(ServiceCategoryEntity)
    private readonly categoryRepo: Repository<ServiceCategoryEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const data of SERVICE_CATEGORY_DATA) {
      const exists = await this.categoryRepo.findOne({
        where: { slug: data.slug },
      });
      if (!exists) {
        await this.categoryRepo.save(
          this.categoryRepo.create({
            slug: data.slug,
            name: data.name,
            basePrice: data.basePrice,
            pricePerKm: data.pricePerKm,
            pricePerHour: data.pricePerHour,
          }),
        );
        this.logger.log(`Seeded service category: ${data.slug}`);
      } else if (
        exists.basePrice !== data.basePrice ||
        exists.pricePerKm !== data.pricePerKm ||
        exists.pricePerHour !== data.pricePerHour
      ) {
        await this.categoryRepo.update(exists.id, {
          basePrice: data.basePrice,
          pricePerKm: data.pricePerKm,
          pricePerHour: data.pricePerHour,
        });
        this.logger.log(`Updated pricing for service category: ${data.slug}`);
      }
    }
  }
}
