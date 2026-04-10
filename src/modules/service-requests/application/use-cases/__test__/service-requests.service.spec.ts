import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BlobStorageService } from '@/common/services/blob-storage.service';
import {
  ProviderProfileEntity,
  ServiceRequestEntity,
  ServiceRequestEventEntity,
  ServiceRequestTechnicianResponseEntity,
  UserEntity,
} from '@/database/entities';
import {
  ProviderVerificationStatus,
  ServiceRequestStatus,
  TechnicianResponseStatus,
  UrgencyLevel,
} from '@/database/enums';
import { TenantContext, TenantDataSourceService } from '@/tenant';
import { TENANT_DATA_SOURCE } from '@/tenant/tenant-datasource.provider';
import { ServiceRequestsGateway } from '../../../presentation/gateways/service-requests.gateway';
import { ServiceRequestsService } from '../service-requests.service';

function buildMockRepo() {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

const USER_ID = 'user-uuid-001';
const TECH_ID = 'tech-uuid-001';
const REQUEST_ID = 'req-uuid-001';

const mockUser = { id: USER_ID };
const mockTechnician = { id: TECH_ID, skills: ['plomeria', 'gas'] };

const mockServiceRequest = {
  id: REQUEST_ID,
  userId: USER_ID,
  assignedTechnicianId: null,
  rawDescription: 'El lavamanos tiene una fuga',
  serviceCity: 'bogota',
  requestedSkills: ['plomeria'],
  status: ServiceRequestStatus.REQUESTED,
  urgency: UrgencyLevel.media,
  latitude: 4.60971,
  longitude: -74.08175,
  addressText: 'Calle 80 # 15-20, Bogota',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  technicianResponses: [],
};

function buildFetchMock(categoria = 'plomeria', urgencia = 'media') {
  const body = JSON.stringify({ categoria, urgencia });
  return jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({
      choices: [{ message: { content: body } }],
    }),
    text: jest.fn().mockResolvedValue(body),
  });
}

describe('ServiceRequestsService', () => {
  let service: ServiceRequestsService;
  let requestRepo: ReturnType<typeof buildMockRepo>;
  let responseRepo: ReturnType<typeof buildMockRepo>;
  let eventRepo: ReturnType<typeof buildMockRepo>;
  let userRepo: ReturnType<typeof buildMockRepo>;
  let providerProfileRepo: ReturnType<typeof buildMockRepo>;
  let mockConfigService: { get: jest.Mock };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    requestRepo = buildMockRepo();
    responseRepo = buildMockRepo();
    eventRepo = buildMockRepo();
    userRepo = buildMockRepo();
    providerProfileRepo = buildMockRepo();

    const repoMap = new Map<unknown, ReturnType<typeof buildMockRepo>>([
      [ServiceRequestEntity, requestRepo],
      [ServiceRequestTechnicianResponseEntity, responseRepo],
      [ServiceRequestEventEntity, eventRepo],
      [UserEntity, userRepo],
    ]);

    const mockDataSource = {
      getRepository: jest.fn(
        (entity: unknown) => repoMap.get(entity) ?? buildMockRepo(),
      ),
    };

    const publicRepoMap = new Map<unknown, ReturnType<typeof buildMockRepo>>([
      [UserEntity, userRepo],
      [ProviderProfileEntity, providerProfileRepo],
    ]);

    const mockManager = {
      getRepository: jest.fn(
        (entity: unknown) => publicRepoMap.get(entity) ?? buildMockRepo(),
      ),
    };

    // userRepo needs a manager property because the service accesses publicUserRepo.manager
    (userRepo as Record<string, unknown>).manager = mockManager;

    const mockPublicDataSource = {
      getRepository: jest.fn(
        (entity: unknown) => publicRepoMap.get(entity) ?? buildMockRepo(),
      ),
    };

    const mockTenantDataSourceService = {
      getDataSource: jest.fn().mockResolvedValue(mockPublicDataSource),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        const cfg: Record<string, string> = {
          'azureAgent.endpoint':
            'https://mock-azure.openai.azure.com/openai/deployments/mock/chat/completions',
          'azureAgent.apiKey': 'mock-api-key',
          'azureAgent.apiVersion': '2024-02-01',
        };
        return cfg[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceRequestsService,
        { provide: TENANT_DATA_SOURCE, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: TenantDataSourceService,
          useValue: mockTenantDataSourceService,
        },
        {
          provide: TenantContext,
          useValue: { getTenantId: jest.fn().mockReturnValue('public') },
        },
        {
          provide: ServiceRequestsGateway,
          useValue: {
            emitNewServiceRequest: jest.fn(),
            emitTechnicianAccepted: jest.fn(),
            emitLocationUpdated: jest.fn(),
            emitServiceStatusUpdated: jest.fn(),
          },
        },
        {
          provide: BlobStorageService,
          useValue: {
            uploadFile: jest.fn(),
            uploadBuffer: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ServiceRequestsService>(ServiceRequestsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      problema: 'El lavamanos tiene una fuga',
      latitude: 4.60971,
      longitude: -74.08175,
      addressText: 'Calle 80 # 15-20',
      serviceCity: 'Bogota',
    };

    it('should classify the problem and persist the service request', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      requestRepo.create.mockReturnValue(mockServiceRequest);
      requestRepo.save.mockResolvedValue(mockServiceRequest);
      requestRepo.findOneOrFail.mockResolvedValue(mockServiceRequest);
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(buildFetchMock('plomeria', 'alta') as unknown);

      const result = await service.create(USER_ID, createDto);

      expect(requestRepo.save).toHaveBeenCalled();
      expect(result.userId).toBe(USER_ID);
    });

    it('should throw NotFoundException when requesting user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.create(USER_ID, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException when Azure config is missing', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      mockConfigService.get.mockReturnValue(undefined);

      await expect(service.create(USER_ID, createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when the fetch network call fails', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));

      await expect(service.create(USER_ID, createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when Azure returns a non-ok status', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue('Rate limit exceeded'),
      } as unknown);

      await expect(service.create(USER_ID, createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when agent returns unparsable JSON', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'not-json-at-all' } }],
        }),
        text: jest.fn(),
      } as unknown);

      await expect(service.create(USER_ID, createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated service requests', async () => {
      requestRepo.findAndCount.mockResolvedValue([[mockServiceRequest], 1]);

      const result = await service.findAll({ page: 0, limit: 10 });

      expect(requestRepo.findAndCount).toHaveBeenCalled();
      expect(result.requests).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(0);
      expect(result.limit).toBe(10);
    });

    it('should apply status, userId and serviceCity filters when provided', async () => {
      requestRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 0,
        limit: 5,
        status: ServiceRequestStatus.ASSIGNED,
        userId: USER_ID,
        serviceCity: 'Medellin',
      });

      const callArg = requestRepo.findAndCount.mock.calls[0][0];
      expect(callArg.where.status).toBe(ServiceRequestStatus.ASSIGNED);
      expect(callArg.where.userId).toBe(USER_ID);
      expect(callArg.where.serviceCity).toBe('medellin');
    });

    it('should use default pagination values when page and limit are omitted', async () => {
      requestRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.page).toBe(0);
      expect(result.limit).toBe(20);
    });
  });

  describe('findAcceptedTechnicians', () => {
    it('should return the list of accepted technicians for a request', async () => {
      requestRepo.findOne.mockResolvedValue({ id: REQUEST_ID });
      responseRepo.find.mockResolvedValue([
        {
          technicianUser: {
            id: TECH_ID,
            fullName: 'John Tech',
            email: 'tech@example.com',
            phoneNumber: '+573001111111',
            skills: ['plomeria'],
            currentLatitude: null,
            currentLongitude: null,
          },
          respondedAt: new Date(),
        },
      ]);

      const result = await service.findAcceptedTechnicians(REQUEST_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(TECH_ID);
    });

    it('should throw NotFoundException when the service request does not exist', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findAcceptedTechnicians('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAvailableForTechnician', () => {
    it('should return available requests matching the technician skills', async () => {
      userRepo.findOne.mockResolvedValue(mockTechnician);
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockServiceRequest]),
      };
      requestRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAvailableForTechnician(TECH_ID);

      expect(result).toHaveLength(1);
    });

    it('should return an empty array when the technician has no skills', async () => {
      userRepo.findOne.mockResolvedValue({ id: TECH_ID, skills: [] });

      const result = await service.findAvailableForTechnician(TECH_ID);

      expect(result).toHaveLength(0);
      expect(requestRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the technician user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.findAvailableForTechnician('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('accept', () => {
    const acceptDto = {};

    it('should record the acceptance and return the updated service request', async () => {
      userRepo.findOne.mockResolvedValue(mockTechnician);
      providerProfileRepo.findOne.mockResolvedValue({
        userId: TECH_ID,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      });
      requestRepo.findOne
        .mockResolvedValueOnce({
          id: REQUEST_ID,
          status: ServiceRequestStatus.REQUESTED,
        })
        .mockResolvedValue(mockServiceRequest);
      responseRepo.findOne.mockResolvedValue(null);
      responseRepo.create.mockReturnValue({
        serviceRequestId: REQUEST_ID,
        technicianUserId: TECH_ID,
        status: TechnicianResponseStatus.ACCEPTED,
      });
      responseRepo.save.mockResolvedValue({});
      eventRepo.create.mockReturnValue({});
      eventRepo.save.mockResolvedValue({});
      requestRepo.findOneOrFail.mockResolvedValue(mockServiceRequest);

      const result = await service.accept(REQUEST_ID, TECH_ID, acceptDto);

      expect(responseRepo.save).toHaveBeenCalled();
      expect(eventRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(REQUEST_ID);
    });

    it('should upsert an existing response when the technician re-accepts', async () => {
      userRepo.findOne.mockResolvedValue(mockTechnician);
      providerProfileRepo.findOne.mockResolvedValue({
        userId: TECH_ID,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      });
      requestRepo.findOne
        .mockResolvedValueOnce({
          id: REQUEST_ID,
          status: ServiceRequestStatus.REQUESTED,
        })
        .mockResolvedValue(mockServiceRequest);
      const existing: unknown = {
        status: TechnicianResponseStatus.REJECTED,
        reason: 'busy',
        respondedAt: new Date(),
      };
      responseRepo.findOne.mockResolvedValue(existing);
      responseRepo.save.mockResolvedValue({});
      eventRepo.create.mockReturnValue({});
      eventRepo.save.mockResolvedValue({});
      requestRepo.findOneOrFail.mockResolvedValue(mockServiceRequest);

      await service.accept(REQUEST_ID, TECH_ID, acceptDto);

      expect(existing.status).toBe(TechnicianResponseStatus.ACCEPTED);
    });

    it('should throw NotFoundException when the technician user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.accept(REQUEST_ID, TECH_ID, acceptDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the service request does not exist', async () => {
      userRepo.findOne.mockResolvedValue(mockTechnician);
      providerProfileRepo.findOne.mockResolvedValue({
        userId: TECH_ID,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      });
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.accept(REQUEST_ID, TECH_ID, acceptDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when request is not in REQUESTED status', async () => {
      userRepo.findOne.mockResolvedValue(mockTechnician);
      providerProfileRepo.findOne.mockResolvedValue({
        userId: TECH_ID,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      });
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: ServiceRequestStatus.ASSIGNED,
      });

      await expect(
        service.accept(REQUEST_ID, TECH_ID, acceptDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('reject', () => {
    const rejectDto = { technicianUserId: TECH_ID, reason: 'Not available' };

    it('should record the rejection and return a success message', async () => {
      userRepo.findOne.mockResolvedValue(mockTechnician);
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: ServiceRequestStatus.REQUESTED,
      });
      responseRepo.findOne.mockResolvedValue(null);
      responseRepo.create.mockReturnValue({});
      responseRepo.save.mockResolvedValue({});
      eventRepo.create.mockReturnValue({});
      eventRepo.save.mockResolvedValue({});

      const result = await service.reject(REQUEST_ID, rejectDto);

      expect(responseRepo.save).toHaveBeenCalled();
      expect(result.message).toContain(REQUEST_ID);
    });

    it('should throw NotFoundException when the technician user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.reject(REQUEST_ID, rejectDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when the service request does not exist', async () => {
      userRepo.findOne.mockResolvedValue(mockTechnician);
      requestRepo.findOne.mockResolvedValue(null);

      await expect(service.reject(REQUEST_ID, rejectDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when request is no longer in REQUESTED status', async () => {
      userRepo.findOne.mockResolvedValue(mockTechnician);
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: ServiceRequestStatus.COMPLETED,
      });

      await expect(service.reject(REQUEST_ID, rejectDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('chooseTechnician', () => {
    const chooseDto = { technicianUserId: TECH_ID };

    it('should assign the technician and return the updated service request', async () => {
      requestRepo.findOne.mockResolvedValueOnce({
        id: REQUEST_ID,
        userId: USER_ID,
        status: ServiceRequestStatus.REQUESTED,
      });
      responseRepo.findOne.mockResolvedValue({
        status: TechnicianResponseStatus.ACCEPTED,
      });
      requestRepo.update.mockResolvedValue({});
      eventRepo.create.mockReturnValue({});
      eventRepo.save.mockResolvedValue({});
      requestRepo.findOneOrFail.mockResolvedValue(mockServiceRequest);
      requestRepo.findOne.mockResolvedValue(mockServiceRequest);

      const result = await service.chooseTechnician(
        REQUEST_ID,
        USER_ID,
        chooseDto,
      );

      expect(requestRepo.update).toHaveBeenCalledWith(
        REQUEST_ID,
        expect.objectContaining({
          assignedTechnicianId: TECH_ID,
          status: ServiceRequestStatus.ON_THE_WAY,
        }),
      );
      expect(result.id).toBe(REQUEST_ID);
    });

    it('should throw NotFoundException when service request does not exist', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.chooseTechnician('nonexistent', USER_ID, chooseDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when the caller is not the request owner', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        userId: 'different-user',
        status: ServiceRequestStatus.REQUESTED,
      });

      await expect(
        service.chooseTechnician(REQUEST_ID, USER_ID, chooseDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when request is not in REQUESTED status', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        userId: USER_ID,
        status: ServiceRequestStatus.ASSIGNED,
      });

      await expect(
        service.chooseTechnician(REQUEST_ID, USER_ID, chooseDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when chosen technician has not accepted the request', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        userId: USER_ID,
        status: ServiceRequestStatus.REQUESTED,
      });
      responseRepo.findOne.mockResolvedValue({
        status: TechnicianResponseStatus.REJECTED,
      });

      await expect(
        service.chooseTechnician(REQUEST_ID, USER_ID, chooseDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when there is no response at all from the technician', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        userId: USER_ID,
        status: ServiceRequestStatus.REQUESTED,
      });
      responseRepo.findOne.mockResolvedValue(null);

      await expect(
        service.chooseTechnician(REQUEST_ID, USER_ID, chooseDto),
      ).rejects.toThrow(ConflictException);
    });
  });
});
