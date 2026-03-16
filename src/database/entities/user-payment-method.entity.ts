import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethodType, RoleName } from '../enums';
import { UserEntity } from './user.entity';

@Entity('user_payment_methods')
@Index(['userId', 'isActive'])
@Index(['userId', 'isDefault'])
export class UserPaymentMethodEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: RoleName, default: RoleName.USER })
  forRole!: RoleName;

  @Column({ type: 'enum', enum: PaymentMethodType })
  methodType!: PaymentMethodType;

  @Column({ type: 'varchar', nullable: true })
  alias!: string | null;

  @Column({ type: 'varchar', nullable: true })
  accountHolder!: string | null;

  @Column({ type: 'varchar', nullable: true })
  accountIdentifier!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(
    () => UserEntity,
    (user) => user.paymentMethods,
    { onDelete: 'CASCADE' },
  )
  user!: UserEntity;
}
