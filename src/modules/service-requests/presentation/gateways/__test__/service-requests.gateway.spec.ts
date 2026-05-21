import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import { WsJwtGuard } from '@/common/guards/ws-jwt.guard';
import { ServiceRequestsGateway } from '../service-requests.gateway';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
  };
}

function buildMockServer() {
  const rooms = new Map<string, Set<string>>();

  return {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    sockets: {
      adapter: {
        rooms,
      },
    },
  };
}

function buildMockClient(
  id = 'client-1',
  userData?: Record<string, unknown>,
): Socket {
  return {
    id,
    data: { user: userData },
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
  } as unknown as Socket;
}

describe('ServiceRequestsGateway', () => {
  let gateway: ServiceRequestsGateway;
  let mockServer: ReturnType<typeof buildMockServer>;
  let mockRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    mockRepo = buildMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceRequestsGateway,
        WsJwtGuard,
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: DataSource,
          useValue: {
            getRepository: jest.fn().mockReturnValue(mockRepo),
          },
        },
      ],
    }).compile();

    gateway = module.get<ServiceRequestsGateway>(ServiceRequestsGateway);
    mockServer = buildMockServer();
    gateway.server = mockServer as unknown as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should log the connecting client id without throwing', () => {
      const client = buildMockClient('connect-001');
      expect(() => gateway.handleConnection(client)).not.toThrow();
    });
  });

  describe('handleDisconnect', () => {
    it('should log the disconnecting client id without throwing', () => {
      const client = buildMockClient('disconnect-001');
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });

  describe('handleJoinRequestRoom', () => {
    it('should join the correct room and return success', () => {
      const client = buildMockClient('socket-001');
      const data = { requestId: 'req-uuid-001' };

      const result = gateway.handleJoinRequestRoom(data, client);

      expect(client.join).toHaveBeenCalledWith('request_req-uuid-001');
      expect(result).toEqual({ success: true, room: 'request_req-uuid-001' });
    });
  });

  describe('handleJoinTechnicianRoom', () => {
    it('should join both rooms when technicianId matches authenticated user', () => {
      const client = buildMockClient('socket-002', { sub: 'tech-uuid-001' });
      const data = { technicianId: 'tech-uuid-001', tenantId: 'bogota' };

      const result = gateway.handleJoinTechnicianRoom(data, client);

      expect(client.join).toHaveBeenCalledWith('technician_tech-uuid-001');
      expect(client.join).toHaveBeenCalledWith('tenant_bogota_technicians');
      expect(result).toEqual({ success: true });
    });

    it('should emit error and return failure when technicianId does not match', () => {
      const client = buildMockClient('socket-003', { sub: 'other-user' });
      const data = { technicianId: 'tech-uuid-001', tenantId: 'bogota' };

      const result = gateway.handleJoinTechnicianRoom(data, client);

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: expect.stringContaining('Unauthorized'),
        }),
      );
      expect(result).toEqual({ success: false });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should return failure when client has no user data', () => {
      const client = buildMockClient('socket-004');
      const data = { technicianId: 'tech-uuid-001', tenantId: 'bogota' };

      const result = gateway.handleJoinTechnicianRoom(data, client);

      expect(result).toEqual({ success: false });
    });
  });

  describe('emitNewServiceRequest', () => {
    it('should emit new_service_request event to the tenant technicians room', () => {
      const mockToChain = { emit: jest.fn() };
      mockServer.to.mockReturnValue(mockToChain as unknown);

      const serviceRequest = { id: 'req-uuid-001' } as unknown;
      gateway.emitNewServiceRequest('bogota', serviceRequest as never);

      expect(mockServer.to).toHaveBeenCalledWith('tenant_bogota_technicians');
      expect(mockToChain.emit).toHaveBeenCalledWith(
        'new_service_request',
        serviceRequest,
      );
    });
  });

  describe('emitTechnicianAccepted', () => {
    it('should emit technician_accepted event to the request room', () => {
      const mockToChain = { emit: jest.fn() };
      mockServer.to.mockReturnValue(mockToChain as unknown);

      const technician = {
        id: 'tech-uuid-001',
        fullName: 'Tech Name',
      } as unknown;
      gateway.emitTechnicianAccepted('req-uuid-001', technician as never);

      expect(mockServer.to).toHaveBeenCalledWith('request_req-uuid-001');
      expect(mockToChain.emit).toHaveBeenCalledWith(
        'technician_accepted',
        technician,
      );
    });
  });

  describe('emitLocationUpdated', () => {
    it('should emit location_updated event with correct data', () => {
      const mockToChain = { emit: jest.fn() };
      mockServer.to.mockReturnValue(mockToChain as unknown);

      const locationData = {
        userId: 'user-001',
        role: 'technician',
        latitude: 4.711,
        longitude: -74.0721,
      };
      gateway.emitLocationUpdated('req-uuid-001', locationData);

      expect(mockServer.to).toHaveBeenCalledWith('request_req-uuid-001');
      expect(mockToChain.emit).toHaveBeenCalledWith(
        'location_updated',
        locationData,
      );
    });
  });

  describe('emitServiceStatusUpdated', () => {
    it('should emit service_status_updated event with requestId and status', () => {
      const mockToChain = { emit: jest.fn() };
      mockServer.to.mockReturnValue(mockToChain as unknown);

      gateway.emitServiceStatusUpdated('req-uuid-001', 'COMPLETED');

      expect(mockServer.to).toHaveBeenCalledWith('request_req-uuid-001');
      expect(mockToChain.emit).toHaveBeenCalledWith('service_status_updated', {
        requestId: 'req-uuid-001',
        status: 'COMPLETED',
      });
    });
  });

  describe('emitTechnicianStatsUpdated', () => {
    it('should emit technician_stats_updated event to the technician room', () => {
      const mockToChain = { emit: jest.fn() };
      mockServer.to.mockReturnValue(mockToChain as unknown);

      gateway.emitTechnicianStatsUpdated('tech-uuid-001', 42);

      expect(mockServer.to).toHaveBeenCalledWith('technician_tech-uuid-001');
      expect(mockToChain.emit).toHaveBeenCalledWith(
        'technician_stats_updated',
        {
          servicesCount: 42,
        },
      );
    });
  });

  describe('emitPaymentCompleted', () => {
    it('should emit payment_completed event with full payment data', () => {
      const mockToChain = { emit: jest.fn() };
      mockServer.to.mockReturnValue(mockToChain as unknown);

      const paymentData = {
        paymentId: 'pay-001',
        amount: 100000,
        method: 'NEQUI',
        status: 'COMPLETED',
        paidAt: new Date(),
      };
      gateway.emitPaymentCompleted('req-uuid-001', paymentData);

      expect(mockServer.to).toHaveBeenCalledWith('request_req-uuid-001');
      expect(mockToChain.emit).toHaveBeenCalledWith('payment_completed', {
        serviceRequestId: 'req-uuid-001',
        ...paymentData,
      });
    });
  });

  describe('handleSendChatMessage', () => {
    it('should return failure when client has no authenticated user', async () => {
      const client = buildMockClient('socket-chat-001');
      const data = { serviceRequestId: 'req-001', content: 'Hola' };

      const result = await gateway.handleSendChatMessage(data, client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Unauthorized',
      });
      expect(result).toEqual({ success: false });
    });

    it('should save message and broadcast to room when authenticated', async () => {
      const savedMsg = {
        id: 'msg-001',
        serviceRequestId: 'req-001',
        senderId: 'user-001',
        content: 'Hola',
        isRead: false,
        sentAt: new Date(),
      };
      mockRepo.create.mockReturnValue(savedMsg);
      mockRepo.save.mockResolvedValue(savedMsg);

      const mockToChain = { emit: jest.fn() };
      mockServer.to.mockReturnValue(mockToChain as unknown);

      const client = buildMockClient('socket-chat-002', { sub: 'user-001' });
      const data = { serviceRequestId: 'req-001', content: 'Hola' };

      const result = await gateway.handleSendChatMessage(data, client);

      expect(mockRepo.create).toHaveBeenCalledWith({
        serviceRequestId: 'req-001',
        senderId: 'user-001',
        content: 'Hola',
      });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockServer.to).toHaveBeenCalledWith('request_req-001');
      expect(mockToChain.emit).toHaveBeenCalledWith(
        'new_chat_message',
        expect.objectContaining({ id: 'msg-001', senderId: 'user-001' }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('emitChatMessage', () => {
    it('should emit new_chat_message to the request room', () => {
      const mockToChain = { emit: jest.fn() };
      mockServer.to.mockReturnValue(mockToChain as unknown);

      const message = {
        id: 'msg-001',
        senderId: 'user-001',
        content: 'Hola',
        isRead: false,
        sentAt: new Date(),
      };
      gateway.emitChatMessage('req-001', message);

      expect(mockServer.to).toHaveBeenCalledWith('request_req-001');
      expect(mockToChain.emit).toHaveBeenCalledWith('new_chat_message', {
        serviceRequestId: 'req-001',
        ...message,
      });
    });
  });
});
