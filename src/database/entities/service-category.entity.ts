import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProviderServiceEntity } from './provider-service.entity';
import { ServiceRequestEntity } from './service-request.entity';
import { ServiceSubcategoryEntity } from './service-subcategory.entity';

@Entity('service_categories')
export class ServiceCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  iconUrl!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'int', default: 0 })
  basePrice!: number;

  @Column({ type: 'int', default: 0 })
  pricePerKm!: number;

  @Column({ type: 'int', default: 0 })
  pricePerHour!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(
    () => ServiceSubcategoryEntity,
    (sc) => sc.category,
  )
  subcategories!: ServiceSubcategoryEntity[];

  @OneToMany(
    () => ProviderServiceEntity,
    (ps) => ps.category,
  )
  providerServices!: ProviderServiceEntity[];

  @OneToMany(
    () => ServiceRequestEntity,
    (sr) => sr.category,
  )
  requests!: ServiceRequestEntity[];
}
