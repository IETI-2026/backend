import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceCategoryEntity } from '../entities/service-category.entity';

const SERVICE_CATEGORY_DATA: Array<{
  slug: string;
  name: string;
  basePrice: number;
  pricePerKm: number;
  pricePerHour: number;
}> = [
  {
    slug: 'plomeria',
    name: 'Plomería',
    basePrice: 50000,
    pricePerKm: 2000,
    pricePerHour: 25000,
  },
  {
    slug: 'electricidad',
    name: 'Electricidad',
    basePrice: 40000,
    pricePerKm: 2000,
    pricePerHour: 20000,
  },
  {
    slug: 'cerrajeria',
    name: 'Cerrajería',
    basePrice: 50000,
    pricePerKm: 2500,
    pricePerHour: 20000,
  },
  {
    slug: 'gas',
    name: 'Gas',
    basePrice: 80000,
    pricePerKm: 2500,
    pricePerHour: 30000,
  },
  {
    slug: 'albanileria',
    name: 'Albanilería',
    basePrice: 100000,
    pricePerKm: 3000,
    pricePerHour: 25000,
  },
  {
    slug: 'carpinteria',
    name: 'Carpintería',
    basePrice: 80000,
    pricePerKm: 3000,
    pricePerHour: 25000,
  },
  {
    slug: 'refrigeracion',
    name: 'Refrigeración',
    basePrice: 80000,
    pricePerKm: 3000,
    pricePerHour: 30000,
  },
  {
    slug: 'tecnologia',
    name: 'Tecnología',
    basePrice: 50000,
    pricePerKm: 2000,
    pricePerHour: 20000,
  },
  {
    slug: 'jardineria',
    name: 'Jardinería',
    basePrice: 60000,
    pricePerKm: 2000,
    pricePerHour: 18000,
  },
  {
    slug: 'pintura',
    name: 'Pintura',
    basePrice: 60000,
    pricePerKm: 2000,
    pricePerHour: 18000,
  },
  {
    slug: 'limpieza',
    name: 'Limpieza',
    basePrice: 60000,
    pricePerKm: 2000,
    pricePerHour: 18000,
  },
  {
    slug: 'impermeabilizacion',
    name: 'Impermeabilización',
    basePrice: 80000,
    pricePerKm: 3000,
    pricePerHour: 25000,
  },
  {
    slug: 'techos',
    name: 'Techos',
    basePrice: 80000,
    pricePerKm: 3000,
    pricePerHour: 25000,
  },
  {
    slug: 'vidrieria',
    name: 'Vidriería',
    basePrice: 60000,
    pricePerKm: 2500,
    pricePerHour: 20000,
  },
  {
    slug: 'soldadura',
    name: 'Soldadura',
    basePrice: 80000,
    pricePerKm: 3000,
    pricePerHour: 25000,
  },
  {
    slug: 'mantenimiento',
    name: 'Mantenimiento',
    basePrice: 60000,
    pricePerKm: 2000,
    pricePerHour: 20000,
  },
  {
    slug: 'mascotas',
    name: 'Mascotas',
    basePrice: 50000,
    pricePerKm: 2000,
    pricePerHour: 18000,
  },
  {
    slug: 'mudanza',
    name: 'Mudanza',
    basePrice: 150000,
    pricePerKm: 4000,
    pricePerHour: 30000,
  },
];

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
