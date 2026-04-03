import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserSubscriptionEntity } from './user-subscription.entity';

@Entity('subscription_plans')
export class SubscriptionPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  priceMonthly!: string;

  @Column({ type: 'varchar', default: 'COP' })
  currency!: string;

  @Column({ type: 'jsonb' })
  features!: unknown;

  @Column({ type: 'float', default: 0.0 })
  priorityBoost!: number;

  @Column({ type: 'int', nullable: true })
  maxRequestsDay!: number | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(
    () => UserSubscriptionEntity,
    (us) => us.plan,
  )
  subscriptions!: UserSubscriptionEntity[];
}
