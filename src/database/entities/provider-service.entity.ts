import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ProviderProfileEntity } from './provider-profile.entity';
import { ServiceCategoryEntity } from './service-category.entity';

@Entity('provider_services')
@Unique(['providerProfileId', 'categoryId'])
export class ProviderServiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  providerProfileId!: string;

  @Column('uuid')
  categoryId!: string;

  @Column({ type: 'int', nullable: true })
  yearsExperience!: number | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => ProviderProfileEntity, (pp) => pp.services, { onDelete: 'CASCADE' })
  provider!: ProviderProfileEntity;

  @ManyToOne(() => ServiceCategoryEntity, (c) => c.providerServices)
  category!: ServiceCategoryEntity;
}
