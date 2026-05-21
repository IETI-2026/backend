import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ServiceRequestEntity } from './service-request.entity';
import { UserEntity } from './user.entity';

@Entity('addresses')
@Index(['userId'])
export class AddressEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'varchar', nullable: true })
  label!: string | null;

  @Column({ type: 'varchar' })
  street!: string;

  @Column({ type: 'varchar', nullable: true })
  neighborhood!: string | null;

  @Column({ type: 'varchar' })
  city!: string;

  @Column({ type: 'varchar', nullable: true })
  department!: string | null;

  @Column({ type: 'varchar', default: 'CO' })
  country!: string;

  @Column({ type: 'varchar', nullable: true })
  postalCode!: string | null;

  @Column({ type: 'float', nullable: true })
  latitude!: number | null;

  @Column({ type: 'float', nullable: true })
  longitude!: number | null;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(
    () => UserEntity,
    (u) => u.addresses,
    { onDelete: 'CASCADE' },
  )
  user!: UserEntity;

  @OneToMany(
    () => ServiceRequestEntity,
    (sr) => sr.address,
  )
  requests!: ServiceRequestEntity[];
}
