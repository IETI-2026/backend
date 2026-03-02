import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserEntity } from "./user.entity";

@Entity("refresh_tokens")
@Index(["userId"])
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  userId!: string;

  @Column({ type: "varchar", unique: true })
  token!: string;

  @Column({ type: "timestamp" })
  expiresAt!: Date;

  @Column({ type: "boolean", default: false })
  isRevoked!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: "varchar", nullable: true })
  userAgent!: string | null;

  @Column({ type: "varchar", nullable: true })
  ipAddress!: string | null;

  @ManyToOne(() => UserEntity, (u) => u.refreshTokens, { onDelete: "CASCADE" })
  user!: UserEntity;
}
