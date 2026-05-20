import { ChatMessageEntity } from '@database/entities';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATA_SOURCE } from '@tenant/tenant-datasource.provider';
import type { DataSource, Repository } from 'typeorm';

@Injectable()
export class ChatService {
  constructor(
    @Inject(TENANT_DATA_SOURCE)
    private readonly ds: DataSource,
  ) {}

  private get repo(): Repository<ChatMessageEntity> {
    return this.ds.getRepository(ChatMessageEntity);
  }

  async sendMessage(
    serviceRequestId: string,
    senderId: string,
    content: string,
  ): Promise<ChatMessageEntity> {
    const msg = this.repo.create({ serviceRequestId, senderId, content });
    return this.repo.save(msg);
  }

  async getMessages(serviceRequestId: string): Promise<ChatMessageEntity[]> {
    return this.repo.find({
      where: { serviceRequestId },
      relations: { sender: true },
      order: { sentAt: 'ASC' },
    });
  }

  async markAsRead(serviceRequestId: string, readerId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update()
      .set({ isRead: true, readAt: new Date() })
      .where('"serviceRequestId" = :serviceRequestId', { serviceRequestId })
      .andWhere('"senderId" != :readerId', { readerId })
      .andWhere('"isRead" = false')
      .execute();
  }
}
