import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ServiceCategoryEntity } from './service-category.entity';
import { ServiceRequestEntity } from './service-request.entity';

@Entity('service_subcategories')
@Unique(['categoryId', 'slug'])
export class ServiceSubcategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  categoryId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(
    () => ServiceCategoryEntity,
    (c) => c.subcategories,
  )
  category!: ServiceCategoryEntity;

  @OneToMany(
    () => ServiceRequestEntity,
    (sr) => sr.subcategory,
  )
  requests!: ServiceRequestEntity[];
}
