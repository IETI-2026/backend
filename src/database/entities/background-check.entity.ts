import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProviderProfileEntity } from './provider-profile.entity';

@Entity('background_checks')
export class BackgroundCheckEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  providerProfileId!: string;

  @Column({ type: 'varchar' })
  documentType!: string;

  @Column({ type: 'varchar' })
  documentHash!: string;

  @Column({ type: 'varchar', nullable: true })
  fileUrl!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  issuedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  verifiedBy!: string | null;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(
    () => ProviderProfileEntity,
    (pp) => pp.backgroundChecks,
    {
      onDelete: 'CASCADE',
    },
  )
  provider!: ProviderProfileEntity;
}
