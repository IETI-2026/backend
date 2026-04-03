import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProviderProfileEntity } from './provider-profile.entity';

@Entity('provider_availability')
export class ProviderAvailabilityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  providerProfileId!: string;

  @Column({ type: 'int' })
  dayOfWeek!: number;

  @Column({ type: 'varchar' })
  startTime!: string;

  @Column({ type: 'varchar' })
  endTime!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(
    () => ProviderProfileEntity,
    (pp) => pp.availability,
    {
      onDelete: 'CASCADE',
    },
  )
  provider!: ProviderProfileEntity;
}
