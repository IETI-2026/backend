import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { RoleEntity } from './role.entity';
import { UserEntity } from './user.entity';

@Entity('user_roles')
export class UserRoleEntity {
  @PrimaryColumn('uuid')
  userId!: string;

  @PrimaryColumn('uuid')
  roleId!: string;

  @CreateDateColumn()
  assignedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  assignedBy!: string | null;

  @ManyToOne(() => UserEntity, (u) => u.roles, { onDelete: 'CASCADE' })
  user!: UserEntity;

  @ManyToOne(() => RoleEntity, (r) => r.users, { onDelete: 'CASCADE' })
  role!: RoleEntity;
}
