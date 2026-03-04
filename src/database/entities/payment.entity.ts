import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethodType, PaymentStatus } from '../enums';
import { ServiceRequestEntity } from './service-request.entity';
import { UserEntity } from './user.entity';

@Entity('payments')
@Index(['userId', 'status'])
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  serviceRequestId!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  grossAmount!: string;

  @Column({ type: 'float' })
  commissionRate!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  commissionAmount!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  netAmount!: string;

  @Column({ type: 'enum', enum: PaymentMethodType })
  paymentMethod!: PaymentMethodType;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ type: 'varchar', nullable: true })
  externalTransactionId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  gatewayReference!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  gatewayResponse!: Record<string, unknown> | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  refundReason!: string | null;

  @Column({ type: 'varchar', nullable: true })
  receiptUrl!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(
    () => ServiceRequestEntity,
    (sr) => sr.payment,
  )
  @JoinColumn({ name: 'serviceRequestId' })
  serviceRequest!: ServiceRequestEntity;

  @ManyToOne(
    () => UserEntity,
    (u) => u.payments,
  )
  user!: UserEntity;
}
