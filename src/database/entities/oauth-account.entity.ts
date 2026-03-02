import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AuthProvider } from '../enums';
import { UserEntity } from './user.entity';

@Entity('oauth_accounts')
@Unique(['provider', 'providerUserId'])
export class OAuthAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'enum', enum: AuthProvider })
  provider!: AuthProvider;

  @Column({ type: 'varchar' })
  providerUserId!: string;

  @Column({ type: 'varchar', nullable: true })
  accessToken!: string | null;

  @Column({ type: 'varchar', nullable: true })
  refreshToken!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => UserEntity, (u) => u.oauthAccounts, { onDelete: 'CASCADE' })
  user!: UserEntity;
}
