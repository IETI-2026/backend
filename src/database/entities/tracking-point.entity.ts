import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProviderProfileEntity } from './provider-profile.entity';

@Entity('tracking_points')
@Index(['providerProfileId', 'recordedAt'])
@Index(['serviceRequestId'])
export class TrackingPointEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  providerProfileId!: string;

  @Column({ type: 'uuid', nullable: true })
  serviceRequestId!: string | null;

  @Column({ type: 'float' })
  latitude!: number;

  @Column({ type: 'float' })
  longitude!: number;

  @Column({ type: 'float', nullable: true })
  accuracyMeters!: number | null;

  @Column({ type: 'float', nullable: true })
  speedKmh!: number | null;

  @Column({ type: 'float', nullable: true })
  headingDegrees!: number | null;

  @CreateDateColumn()
  recordedAt!: Date;

  @ManyToOne(
    () => ProviderProfileEntity,
    (pp) => pp.trackingPoints,
    {
      onDelete: 'CASCADE',
    },
  )
  provider!: ProviderProfileEntity;
}
