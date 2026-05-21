import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { TechnicianResponseStatus } from '../enums';
import { ServiceRequestEntity } from './service-request.entity';
import { UserEntity } from './user.entity';

@Entity('service_request_technician_responses')
@Unique(['serviceRequestId', 'technicianUserId'])
@Index(['serviceRequestId', 'status'])
@Index(['technicianUserId', 'status'])
export class ServiceRequestTechnicianResponseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  serviceRequestId!: string;

  @Column('uuid')
  technicianUserId!: string;

  @Column({ type: 'enum', enum: TechnicianResponseStatus })
  status!: TechnicianResponseStatus;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  respondedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(
    () => ServiceRequestEntity,
    (sr) => sr.technicianResponses,
    {
      onDelete: 'CASCADE',
    },
  )
  serviceRequest!: ServiceRequestEntity;

  @ManyToOne(
    () => UserEntity,
    (u) => u.technicianResponses,
    {
      onDelete: 'CASCADE',
    },
  )
  technicianUser!: UserEntity;
}
