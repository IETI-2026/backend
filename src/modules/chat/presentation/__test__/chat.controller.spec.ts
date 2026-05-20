import type { ChatMessageEntity } from '@database/entities';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtPayloadEntity } from '../../../auth/domain/entities';
import { ServiceRequestsGateway } from '../../../service-requests/presentation/gateways/service-requests.gateway';
import { ChatService } from '../../application/chat.service';
import { ChatController } from '../chat.controller';

function makeUser(sub?: string): JwtPayloadEntity {
  return { sub, email: 'user@test.com', roles: [] } as JwtPayloadEntity;
}

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

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: jest.Mocked<ChatService>;
  let gateway: jest.Mocked<Pick<ServiceRequestsGateway, 'emitChatMessage'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            getMessages: jest.fn(),
            sendMessage: jest.fn(),
            markAsRead: jest.fn(),
          },
        },
        {
          provide: ServiceRequestsGateway,
          useValue: { emitChatMessage: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get(ChatService);
    gateway = module.get(ServiceRequestsGateway);
  });

  describe('getMessages', () => {
    it('returns the list of chat messages', async () => {
      const msgs = [makeChatMsg()];
      chatService.getMessages.mockResolvedValue(msgs);

      const result = await controller.getMessages('req-1');

      expect(chatService.getMessages).toHaveBeenCalledWith('req-1');
      expect(result).toEqual(msgs);
    });

    it('returns empty array when no messages', async () => {
      chatService.getMessages.mockResolvedValue([]);

      const result = await controller.getMessages('req-empty');

      expect(result).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    it('saves the message and emits a WebSocket event', async () => {
      const msg = makeChatMsg({ content: 'En camino' });
      chatService.sendMessage.mockResolvedValue(msg);

      const result = await controller.sendMessage(
        'req-1',
        { content: 'En camino' },
        makeUser('user-1'),
      );

      expect(chatService.sendMessage).toHaveBeenCalledWith(
        'req-1',
        'user-1',
        'En camino',
      );
      expect(gateway.emitChatMessage).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ id: msg.id, senderId: msg.senderId }),
      );
      expect(result.content).toBe('En camino');
    });

    it('throws BadRequestException when user has no sub', async () => {
      await expect(
        controller.sendMessage('req-1', { content: 'Hola' }, makeUser()),
      ).rejects.toThrow(BadRequestException);

      expect(chatService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('marks messages as read successfully', async () => {
      chatService.markAsRead.mockResolvedValue(undefined);

      await controller.markAsRead('req-1', makeUser('user-1'));

      expect(chatService.markAsRead).toHaveBeenCalledWith('req-1', 'user-1');
    });

    it('throws BadRequestException when user has no sub', async () => {
      await expect(controller.markAsRead('req-1', makeUser())).rejects.toThrow(
        BadRequestException,
      );

      expect(chatService.markAsRead).not.toHaveBeenCalled();
    });
  });
});
