import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ServiceRequestEntity } from './service-request.entity';
import { RatingPhotoEntity } from './rating-photo.entity';
import { UserEntity } from './user.entity';

@Entity('ratings')
export class RatingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  serviceRequestId!: string;

  @Column('uuid')
  authorId!: string;

  @Column('uuid')
  targetId!: string;

  @Column({ type: 'int' })
  stars!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment!: string | null;

  @Column({ type: 'boolean', default: true })
  isPublic!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => ServiceRequestEntity, (sr) => sr.rating)
  @JoinColumn({ name: 'serviceRequestId' })
  serviceRequest!: ServiceRequestEntity;

  @ManyToOne(() => UserEntity, (u) => u.ratingsGiven)
  author!: UserEntity;

  @ManyToOne(() => UserEntity, (u) => u.ratingsReceived)
  target!: UserEntity;

  @OneToMany(() => RatingPhotoEntity, (rp) => rp.rating)
  photos!: RatingPhotoEntity[];
}
