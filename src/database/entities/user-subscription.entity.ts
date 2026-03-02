import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { SubscriptionStatus } from "../enums";
import { SubscriptionPlanEntity } from "./subscription-plan.entity";
import { UserEntity } from "./user.entity";

@Entity("user_subscriptions")
@Index(["userId", "status"])
export class UserSubscriptionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  userId!: string;

  @Column("uuid")
  planId!: string;

  @Column({
    type: "enum",
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDING,
  })
  status!: SubscriptionStatus;

  @Column({ type: "timestamp", default: () => "now()" })
  startedAt!: Date;

  @Column({ type: "timestamp" })
  expiresAt!: Date;

  @Column({ type: "timestamp", nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: "boolean", default: true })
  autoRenew!: boolean;

  @Column({ type: "varchar", nullable: true })
  paymentRef!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, (u) => u.subscriptions, { onDelete: "CASCADE" })
  user!: UserEntity;

  @ManyToOne(() => SubscriptionPlanEntity, (sp) => sp.subscriptions)
  plan!: SubscriptionPlanEntity;
}
