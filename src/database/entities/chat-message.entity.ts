import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ServiceRequestEntity } from './service-request.entity';
import { UserEntity } from './user.entity';

@Entity('chat_messages')
@Index(['serviceRequestId', 'sentAt'])
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  serviceRequestId!: string;

  @Column('uuid')
  senderId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  sentAt!: Date;

  @ManyToOne(
    () => ServiceRequestEntity,
    (sr) => sr.chatMessages,
    {
      onDelete: 'CASCADE',
    },
  )
  serviceRequest!: ServiceRequestEntity;

  @ManyToOne(
    () => UserEntity,
    (u) => u.chatMessages,
  )
  sender!: UserEntity;
}
