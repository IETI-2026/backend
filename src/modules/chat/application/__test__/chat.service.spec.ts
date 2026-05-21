import { ChatMessageEntity } from '@database/entities';
import type { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { ChatService } from '../chat.service';

function makeChatMsg(
  overrides: Partial<ChatMessageEntity> = {},
): ChatMessageEntity {
  return {
    id: 'msg-1',
    serviceRequestId: 'req-1',
    senderId: 'user-1',
    content: 'Hola',
    isRead: false,
    readAt: null,
    sentAt: new Date('2024-01-01'),
    sender: null as never,
    serviceRequest: null as never,
    ...overrides,
  };
}

describe('ChatService', () => {
  let service: ChatService;
  let mockRepo: jest.Mocked<
    Pick<
      Repository<ChatMessageEntity>,
      'create' | 'save' | 'find' | 'createQueryBuilder'
    >
  >;
  let mockDs: Partial<DataSource>;

  beforeEach(() => {
    const mockQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as SelectQueryBuilder<ChatMessageEntity>;

    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    mockDs = {
      getRepository: jest.fn().mockReturnValue(mockRepo),
    };

    service = new ChatService(mockDs as DataSource);
  });

  describe('sendMessage', () => {
    it('creates and saves a chat message', async () => {
      const msg = makeChatMsg();
      mockRepo.create.mockReturnValue(msg);
      mockRepo.save.mockResolvedValue(msg);

      const result = await service.sendMessage('req-1', 'user-1', 'Hola');

      expect(mockRepo.create).toHaveBeenCalledWith({
        serviceRequestId: 'req-1',
        senderId: 'user-1',
        content: 'Hola',
      });
      expect(mockRepo.save).toHaveBeenCalledWith(msg);
      expect(result.id).toBe('msg-1');
    });

    it('returns the saved entity', async () => {
      const msg = makeChatMsg({ content: 'En camino' });
      mockRepo.create.mockReturnValue(msg);
      mockRepo.save.mockResolvedValue(msg);

      const result = await service.sendMessage('req-1', 'user-2', 'En camino');

      expect(result.content).toBe('En camino');
    });
  });

  describe('getMessages', () => {
    it('returns messages ordered by sentAt ASC with sender relation', async () => {
      const msgs = [
        makeChatMsg({ sentAt: new Date('2024-01-01') }),
        makeChatMsg({ id: 'msg-2', sentAt: new Date('2024-01-02') }),
      ];
      mockRepo.find.mockResolvedValue(msgs);

      const result = await service.getMessages('req-1');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { serviceRequestId: 'req-1' },
        relations: { sender: true },
        order: { sentAt: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no messages exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getMessages('req-no-msgs');

      expect(result).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    it('executes update query to mark messages as read', async () => {
      await service.markAsRead('req-1', 'user-2');

      expect(mockRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('does not throw when no unread messages exist', async () => {
      await expect(
        service.markAsRead('req-1', 'user-2'),
      ).resolves.toBeUndefined();
    });
  });
});
