import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProviderProfileEntity } from './provider-profile.entity';
import { ServiceRequestEntity } from './service-request.entity';

@Entity('service_assignments')
export class ServiceAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  serviceRequestId!: string;

  @Column('uuid')
  providerProfileId!: string;

  @Column({ type: 'float', nullable: true })
  distanceKm!: number | null;

  @Column({ type: 'float', nullable: true })
  compatibilityScore!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  scoringBreakdown!: Record<string, unknown> | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  offeredAt!: Date;

  @Column({ type: 'timestamp' })
  responseDeadline!: Date;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => ServiceRequestEntity, (sr) => sr.assignment)
  @JoinColumn({ name: 'serviceRequestId' })
  serviceRequest!: ServiceRequestEntity;

  @ManyToOne(() => ProviderProfileEntity, (pp) => pp.assignments)
  provider!: ProviderProfileEntity;
}
