import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoleName, UserStatus } from '../enums';
import { AddressEntity } from './address.entity';
import { AuditLogEntity } from './audit-log.entity';
import { ChatMessageEntity } from './chat-message.entity';
import { NotificationEntity } from './notification.entity';
import { OAuthAccountEntity } from './oauth-account.entity';
import { OtpCodeEntity } from './otp-code.entity';
import { PasswordResetTokenEntity } from './password-reset-token.entity';
import { PaymentEntity } from './payment.entity';
import { ProviderProfileEntity } from './provider-profile.entity';
import { RatingEntity } from './rating.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { ServiceRequestEntity } from './service-request.entity';
import { ServiceRequestTechnicianResponseEntity } from './service-request-technician-response.entity';
import { UserPaymentMethodEntity } from './user-payment-method.entity';
import { UserRoleEntity } from './user-role.entity';
import { UserSubscriptionEntity } from './user-subscription.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  phoneNumber!: string | null;

  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar' })
  fullName!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  documentId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  profilePhotoUrl!: string | null;

  @Column('text', { array: true, default: '{}' })
  skills!: string[];

  @Column({ type: 'float', nullable: true })
  currentLatitude!: number | null;

  @Column({ type: 'float', nullable: true })
  currentLongitude!: number | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLocationUpdate!: Date | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'boolean', default: false })
  phoneVerified!: boolean;

  @Column({ type: 'enum', enum: RoleName, default: RoleName.USER })
  primaryRole!: RoleName;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'int', default: 0 })
  servicesCount!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(
    () => UserRoleEntity,
    (ur) => ur.user,
  )
  roles!: UserRoleEntity[];

  @OneToMany(
    () => OAuthAccountEntity,
    (oa) => oa.user,
  )
  oauthAccounts!: OAuthAccountEntity[];

  @OneToMany(
    () => RefreshTokenEntity,
    (rt) => rt.user,
  )
  refreshTokens!: RefreshTokenEntity[];

  @OneToMany(
    () => PasswordResetTokenEntity,
    (prt) => prt.user,
  )
  passwordResetTokens!: PasswordResetTokenEntity[];

  @OneToMany(
    () => OtpCodeEntity,
    (otp) => otp.user,
  )
  otpCodes!: OtpCodeEntity[];

  @OneToOne(
    () => ProviderProfileEntity,
    (pp) => pp.user,
  )
  providerProfile!: ProviderProfileEntity;

  @OneToMany(
    () => AddressEntity,
    (a) => a.user,
  )
  addresses!: AddressEntity[];

  @OneToMany(
    () => ServiceRequestEntity,
    (sr) => sr.user,
  )
  serviceRequests!: ServiceRequestEntity[];

  @OneToMany(
    () => ServiceRequestEntity,
    (sr) => sr.assignedTechnician,
  )
  assignedRequests!: ServiceRequestEntity[];

  @OneToMany(
    () => PaymentEntity,
    (p) => p.user,
  )
  payments!: PaymentEntity[];

  @OneToMany(
    () => UserPaymentMethodEntity,
    (paymentMethod) => paymentMethod.user,
  )
  paymentMethods!: UserPaymentMethodEntity[];

  @OneToMany(
    () => RatingEntity,
    (r) => r.author,
  )
  ratingsGiven!: RatingEntity[];

  @OneToMany(
    () => RatingEntity,
    (r) => r.target,
  )
  ratingsReceived!: RatingEntity[];

  @OneToMany(
    () => NotificationEntity,
    (n) => n.user,
  )
  notifications!: NotificationEntity[];

  @OneToMany(
    () => AuditLogEntity,
    (al) => al.user,
  )
  auditLogs!: AuditLogEntity[];

  @OneToMany(
    () => ChatMessageEntity,
    (cm) => cm.sender,
  )
  chatMessages!: ChatMessageEntity[];

  @OneToMany(
    () => UserSubscriptionEntity,
    (us) => us.user,
  )
  subscriptions!: UserSubscriptionEntity[];

  @OneToMany(
    () => ServiceRequestTechnicianResponseEntity,
    (tr) => tr.technicianUser,
  )
  technicianResponses!: ServiceRequestTechnicianResponseEntity[];
}
