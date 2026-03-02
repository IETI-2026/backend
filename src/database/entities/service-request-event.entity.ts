import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ServiceRequestStatus } from '../enums';
import { ServiceRequestEntity } from './service-request.entity';

@Entity('service_request_events')
@Index(['serviceRequestId'])
export class ServiceRequestEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  serviceRequestId!: string;

  @Column({ type: 'enum', enum: ServiceRequestStatus, nullable: true })
  previousStatus!: ServiceRequestStatus | null;

  @Column({ type: 'enum', enum: ServiceRequestStatus })
  newStatus!: ServiceRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  triggeredBy!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => ServiceRequestEntity, (sr) => sr.events, { onDelete: 'CASCADE' })
  serviceRequest!: ServiceRequestEntity;
}
