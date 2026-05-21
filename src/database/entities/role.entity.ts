import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RoleName } from '../enums';
import { UserRoleEntity } from './user-role.entity';

@Entity('roles')
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: RoleName, unique: true })
  name!: RoleName;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(
    () => UserRoleEntity,
    (ur) => ur.role,
  )
  users!: UserRoleEntity[];
}
