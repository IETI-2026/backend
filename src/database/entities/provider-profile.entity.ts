import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ProviderVerificationStatus } from "../enums";
import { BackgroundCheckEntity } from "./background-check.entity";
import { ProviderAvailabilityEntity } from "./provider-availability.entity";
import { ProviderServiceEntity } from "./provider-service.entity";
import { ServiceAssignmentEntity } from "./service-assignment.entity";
import { TrackingPointEntity } from "./tracking-point.entity";
import { UserEntity } from "./user.entity";

@Entity("provider_profiles")
export class ProviderProfileEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", unique: true })
  userId!: string;

  @Column({ type: "text", nullable: true })
  bio!: string | null;

  @Column({
    type: "enum",
    enum: ProviderVerificationStatus,
    default: ProviderVerificationStatus.UNVERIFIED,
  })
  verificationStatus!: ProviderVerificationStatus;

  @Column({ type: "float", default: 0.0 })
  averageRating!: number;

  @Column({ type: "int", default: 0 })
  totalRatings!: number;

  @Column({ type: "int", default: 0 })
  totalCompletedServices!: number;

  @Column({ type: "int", default: 0 })
  totalCancelledServices!: number;

  @Column({ type: "float", default: 1.0 })
  scoringMultiplier!: number;

  @Column({ type: "boolean", default: false })
  isAvailable!: boolean;

  @Column({ type: "float", nullable: true })
  currentLatitude!: number | null;

  @Column({ type: "float", nullable: true })
  currentLongitude!: number | null;

  @Column({ type: "timestamp", nullable: true })
  lastLocationUpdate!: Date | null;

  @Column({ type: "float", default: 10.0 })
  coverageRadiusKm!: number;

  @Column({ type: "varchar", nullable: true })
  bankAccountInfo!: string | null;

  @Column({ type: "varchar", nullable: true })
  nequiNumber!: string | null;

  @Column({ type: "varchar", nullable: true })
  daviplataNumber!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => UserEntity, (u) => u.providerProfile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: UserEntity;

  @OneToMany(() => ProviderServiceEntity, (ps) => ps.provider)
  services!: ProviderServiceEntity[];

  @OneToMany(() => BackgroundCheckEntity, (bc) => bc.provider)
  backgroundChecks!: BackgroundCheckEntity[];

  @OneToMany(() => ServiceAssignmentEntity, (sa) => sa.provider)
  assignments!: ServiceAssignmentEntity[];

  @OneToMany(() => ProviderAvailabilityEntity, (pa) => pa.provider)
  availability!: ProviderAvailabilityEntity[];

  @OneToMany(() => TrackingPointEntity, (tp) => tp.provider)
  trackingPoints!: TrackingPointEntity[];
}
