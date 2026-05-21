import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('audit_logs')
@Index(['resource', 'resourceId'])
@Index(['userId'])
@Index(['createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar' })
  resource!: string;

  @Column({ type: 'varchar', nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  oldValues!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  newValues!: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(
    () => UserEntity,
    (u) => u.auditLogs,
    {
      onDelete: 'SET NULL',
      nullable: true,
    },
  )
  user!: UserEntity | null;
}
