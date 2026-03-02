import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserEntity } from "./user.entity";

@Entity("otp_codes")
@Index(["phone"])
@Index(["phone", "code"])
export class OtpCodeEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "varchar" })
  phone!: string;

  @Column({ type: "varchar" })
  code!: string;

  @Column({ type: "timestamp" })
  expiresAt!: Date;

  @Column({ type: "timestamp", nullable: true })
  usedAt!: Date | null;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => UserEntity, (u) => u.otpCodes, {
    onDelete: "CASCADE",
    nullable: true,
  })
  user!: UserEntity | null;
}
