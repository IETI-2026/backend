import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CancellationReason,
  ServiceRequestStatus,
  UrgencyLevel,
} from '../enums';
import { AddressEntity } from './address.entity';
import { ChatMessageEntity } from './chat-message.entity';
import { PaymentEntity } from './payment.entity';
import { RatingEntity } from './rating.entity';
import { ServiceAssignmentEntity } from './service-assignment.entity';
import { ServiceCategoryEntity } from './service-category.entity';
import { ServiceRequestEventEntity } from './service-request-event.entity';
import { ServiceRequestTechnicianResponseEntity } from './service-request-technician-response.entity';
import { ServiceSubcategoryEntity } from './service-subcategory.entity';
import { UserEntity } from './user.entity';

@Entity('service_requests')
@Index(['userId', 'status'])
@Index(['assignedTechnicianId'])
@Index(['status', 'createdAt'])
export class ServiceRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  assignedTechnicianId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  subcategoryId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  addressId!: string | null;

  @Column({ type: 'text' })
  rawDescription!: string;

  @Column({ type: 'varchar' })
  serviceCity!: string;

  @Column('text', { array: true, default: '{}' })
  requestedSkills!: string[];

  // Resultado del procesamiento IA
  @Column({ type: 'varchar', nullable: true })
  aiCategoryId!: string | null;

  @Column({ type: 'float', nullable: true })
  aiUrgencyScore!: number | null;

  @Column({ type: 'float', nullable: true })
  aiConfidenceScore!: number | null;

  @Column({ type: 'int', nullable: true })
  aiEstimatedDurationMin!: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  aiEstimatedCostMin!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  aiEstimatedCostMax!: string | null;

  @Column('text', { array: true, default: '{}' })
  aiKeywords!: string[];

  @Column({ type: 'timestamp', nullable: true })
  aiProcessedAt!: Date | null;

  // Ubicación
  @Column({ type: 'float' })
  latitude!: number;

  @Column({ type: 'float' })
  longitude!: number;

  @Column({ type: 'text' })
  addressText!: string;

  @Column({ type: 'enum', enum: UrgencyLevel, default: UrgencyLevel.media })
  urgency!: UrgencyLevel;

  @Column({
    type: 'enum',
    enum: ServiceRequestStatus,
    default: ServiceRequestStatus.REQUESTED,
  })
  status!: ServiceRequestStatus;

  // Presupuesto
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budgetMin!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budgetMax!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  finalPrice!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: 'enum', enum: CancellationReason, nullable: true })
  cancellationReason!: CancellationReason | null;

  @Column({ type: 'text', nullable: true })
  cancellationNote!: string | null;

  // Relations
  @ManyToOne(() => UserEntity, (u) => u.serviceRequests)
  user!: UserEntity;

  @ManyToOne(() => UserEntity, (u) => u.assignedRequests, { nullable: true })
  assignedTechnician!: UserEntity | null;

  @ManyToOne(() => ServiceCategoryEntity, (c) => c.requests, { nullable: true })
  category!: ServiceCategoryEntity | null;

  @ManyToOne(() => ServiceSubcategoryEntity, (sc) => sc.requests, { nullable: true })
  subcategory!: ServiceSubcategoryEntity | null;

  @ManyToOne(() => AddressEntity, (a) => a.requests, { nullable: true })
  address!: AddressEntity | null;

  @OneToOne(() => ServiceAssignmentEntity, (sa) => sa.serviceRequest)
  assignment!: ServiceAssignmentEntity;

  @OneToMany(() => ServiceRequestEventEntity, (e) => e.serviceRequest)
  events!: ServiceRequestEventEntity[];

  @OneToOne(() => PaymentEntity, (p) => p.serviceRequest)
  payment!: PaymentEntity;

  @OneToOne(() => RatingEntity, (r) => r.serviceRequest)
  rating!: RatingEntity;

  @OneToMany(() => ChatMessageEntity, (cm) => cm.serviceRequest)
  chatMessages!: ChatMessageEntity[];

  @OneToMany(() => ServiceRequestTechnicianResponseEntity, (tr) => tr.serviceRequest)
  technicianResponses!: ServiceRequestTechnicianResponseEntity[];
}
