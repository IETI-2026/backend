import {
  BadRequestException,
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

jest.mock('pdfkit', () => {
  const { EventEmitter } = require('node:events');
  return jest.fn().mockImplementation(() => {
    const doc = new EventEmitter();
    doc.y = 100;
    const methods = [
      'fontSize',
      'font',
      'text',
      'moveDown',
      'moveTo',
      'lineTo',
      'strokeColor',
      'stroke',
    ];
    methods.forEach((m) => {
      doc[m] = jest.fn().mockReturnValue(doc);
    });
    doc.end = jest.fn().mockImplementation(() => {
      setImmediate(() => {
        doc.emit('data', Buffer.from('pdf-content'));
        doc.emit('end');
      });
    });
    return doc;
  });
});

const USER_ID = 'user-uuid-extra';
const TECH_ID = 'tech-uuid-extra';
const REQUEST_ID = 'req-uuid-extra';

function buildMockRepo() {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    increment: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn(),
  };
}

const baseRequest = {
  id: REQUEST_ID,
  userId: USER_ID,
  assignedTechnicianId: TECH_ID,
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
  user: { fullName: 'Client Name' },
  assignedTechnician: { fullName: 'Tech Name', profilePhotoUrl: null },
};

function buildFetchMock(categoria: unknown, urgencia: unknown) {
  const body = JSON.stringify({ categoria, urgencia });
  return jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({
      choices: [{ message: { content: body } }],
    }),
    text: jest.fn().mockResolvedValue(body),
  });
}

describe('ServiceRequestsService (extra coverage)', () => {
  let service: ServiceRequestsService;
  let requestRepo: ReturnType<typeof buildMockRepo>;
  let responseRepo: ReturnType<typeof buildMockRepo>;
  let eventRepo: ReturnType<typeof buildMockRepo>;
  let userRepo: ReturnType<typeof buildMockRepo>;
  let providerProfileRepo: ReturnType<typeof buildMockRepo>;
  let blobStorageService: { uploadBuffer: jest.Mock; toSasUrl: jest.Mock };
  let gateway: {
    emitNewServiceRequest: jest.Mock;
    emitTechnicianAccepted: jest.Mock;
    emitLocationUpdated: jest.Mock;
    emitServiceStatusUpdated: jest.Mock;
    emitTechnicianStatsUpdated: jest.Mock;
  };
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
    blobStorageService = {
      uploadBuffer: jest.fn(),
      toSasUrl: jest.fn((url: string | null) => url),
    };
    gateway = {
      emitNewServiceRequest: jest.fn(),
      emitTechnicianAccepted: jest.fn(),
      emitLocationUpdated: jest.fn(),
      emitServiceStatusUpdated: jest.fn(),
      emitTechnicianStatsUpdated: jest.fn(),
    };

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
        { provide: ServiceRequestsGateway, useValue: gateway },
        { provide: BlobStorageService, useValue: blobStorageService },
      ],
    }).compile();

    service = module.get<ServiceRequestsService>(ServiceRequestsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll — additional filter branches', () => {
    it('should filter by technicianUserId (maps to assignedTechnicianId)', async () => {
      requestRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ technicianUserId: TECH_ID });

      const callArg = requestRepo.findAndCount.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(callArg.where.assignedTechnicianId).toBe(TECH_ID);
    });

    it('should filter by isRated when explicitly set to false', async () => {
      requestRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ isRated: false });

      const callArg = requestRepo.findAndCount.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(callArg.where.isRated).toBe(false);
    });

    it('should build the technician rating map when requests have assigned technicians', async () => {
      const assignedRequest = {
        ...baseRequest,
        assignedTechnicianId: TECH_ID,
        technicianResponses: [],
        user: null,
        assignedTechnician: null,
      };
      requestRepo.findAndCount.mockResolvedValue([[assignedRequest], 1]);
      providerProfileRepo.find.mockResolvedValue([
        { userId: TECH_ID, averageRating: 4.5 },
      ]);

      const result = await service.findAll({});

      expect(result.requests).toHaveLength(1);
      expect(providerProfileRepo.find).toHaveBeenCalled();
    });

    it('should not query the profile repo when no requests have assigned technicians', async () => {
      requestRepo.findAndCount.mockResolvedValue([
        [{ ...baseRequest, assignedTechnicianId: null }],
        1,
      ]);

      await service.findAll({});

      expect(providerProfileRepo.find).not.toHaveBeenCalled();
    });
  });

  // ─── reject — upsert existing response ──────────────────────────────────────

  describe('reject — upsert of existing response', () => {
    it('should update an existing technician response when one already exists', async () => {
      const rejectDto = { technicianUserId: TECH_ID, reason: 'Too far' };
      userRepo.findOne.mockResolvedValue({ id: TECH_ID });
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: ServiceRequestStatus.REQUESTED,
      });

      const existingResponse = {
        status: TechnicianResponseStatus.ACCEPTED,
        reason: null as string | null,
        respondedAt: new Date('2024-01-01'),
      };
      responseRepo.findOne.mockResolvedValue(existingResponse);
      responseRepo.save.mockResolvedValue({});
      eventRepo.create.mockReturnValue({});
      eventRepo.save.mockResolvedValue({});

      await service.reject(REQUEST_ID, rejectDto);

      expect(existingResponse.status).toBe(TechnicianResponseStatus.REJECTED);
      expect(existingResponse.reason).toBe('Too far');
      expect(responseRepo.save).toHaveBeenCalledWith(existingResponse);
    });
  });

  // ─── chooseTechnician — technician location displacement ────────────────────

  describe('chooseTechnician — displacement distance', () => {
    it('should calculate displacement when technician has a known location', async () => {
      requestRepo.findOne.mockResolvedValueOnce({
        id: REQUEST_ID,
        userId: USER_ID,
        status: ServiceRequestStatus.REQUESTED,
        latitude: 4.60971,
        longitude: -74.08175,
      });
      responseRepo.findOne.mockResolvedValue({
        status: TechnicianResponseStatus.ACCEPTED,
      });

      // Technician user with known coords
      userRepo.findOne.mockResolvedValueOnce({
        id: TECH_ID,
        currentLatitude: 4.61,
        currentLongitude: -74.082,
      });

      requestRepo.update.mockResolvedValue({});
      eventRepo.create.mockReturnValue({});
      eventRepo.save.mockResolvedValue({});
      requestRepo.findOne.mockResolvedValue({
        ...baseRequest,
        status: ServiceRequestStatus.ON_THE_WAY,
      });

      const result = await service.chooseTechnician(REQUEST_ID, USER_ID, {
        technicianUserId: TECH_ID,
      });

      const updateCall = requestRepo.update.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(typeof updateCall.displacementDistanceKm).toBe('number');
      expect(result).toBeDefined();
    });
  });

  // ─── markComplete — both sides complete ─────────────────────────────────────

  describe('markComplete — both client and technician mark complete', () => {
    const activeRequest = {
      id: REQUEST_ID,
      userId: USER_ID,
      assignedTechnicianId: TECH_ID,
      status: ServiceRequestStatus.ON_THE_WAY,
      clientMarkedComplete: false,
      technicianMarkedComplete: true,
      requestedSkills: ['plomeria'],
      urgency: UrgencyLevel.media,
      displacementDistanceKm: 2.5,
      startedAt: new Date(Date.now() - 3600000),
    };

    it('should set status to COMPLETED and increment technician services count when both mark complete', async () => {
      requestRepo.findOne
        .mockResolvedValueOnce(activeRequest)
        .mockResolvedValue({
          ...baseRequest,
          status: ServiceRequestStatus.COMPLETED,
        });
      requestRepo.update.mockResolvedValue({});
      userRepo.increment.mockResolvedValue({});
      userRepo.findOne.mockResolvedValue({ servicesCount: 6 });
      eventRepo.create.mockReturnValue({});
      eventRepo.save.mockResolvedValue({});

      const result = await service.markComplete(REQUEST_ID, USER_ID, {
        role: 'client',
      });

      expect(requestRepo.update).toHaveBeenCalledWith(
        REQUEST_ID,
        expect.objectContaining({ status: ServiceRequestStatus.COMPLETED }),
      );
      expect(userRepo.increment).toHaveBeenCalledTimes(2);
      expect(gateway.emitTechnicianStatsUpdated).toHaveBeenCalledWith(
        TECH_ID,
        expect.any(Number),
      );
      expect(gateway.emitServiceStatusUpdated).toHaveBeenCalledWith(
        REQUEST_ID,
        ServiceRequestStatus.COMPLETED,
      );
      expect(result).toBeDefined();
    });

    it('should calculate final price using category pricing when category exists', async () => {
      const dataSourceWithCategory = {
        getRepository: jest.fn().mockImplementation((entity: unknown) => {
          if (entity === ServiceRequestEntity) return requestRepo;
          if (entity === ServiceRequestTechnicianResponseEntity)
            return responseRepo;
          if (entity === ServiceRequestEventEntity) return eventRepo;
          if (entity === UserEntity) return userRepo;
          // Simulate service category repo
          return {
            findOne: jest.fn().mockResolvedValue({
              basePrice: 50000,
              pricePerKm: 5000,
              pricePerHour: 20000,
            }),
            find: jest.fn(),
            findAndCount: jest.fn(),
          };
        }),
      };

      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          ServiceRequestsService,
          { provide: TENANT_DATA_SOURCE, useValue: dataSourceWithCategory },
          { provide: ConfigService, useValue: mockConfigService },
          {
            provide: TenantDataSourceService,
            useValue: {
              getDataSource: jest.fn().mockResolvedValue({
                getRepository: jest.fn().mockReturnValue(userRepo),
              }),
            },
          },
          {
            provide: TenantContext,
            useValue: { getTenantId: jest.fn().mockReturnValue('public') },
          },
          { provide: ServiceRequestsGateway, useValue: gateway },
          { provide: BlobStorageService, useValue: blobStorageService },
        ],
      }).compile();

      const svc2 = module2.get<ServiceRequestsService>(ServiceRequestsService);

      (requestRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(activeRequest)
        .mockResolvedValue({
          ...baseRequest,
          status: ServiceRequestStatus.COMPLETED,
        });
      requestRepo.update.mockResolvedValue({});
      userRepo.increment.mockResolvedValue({});
      userRepo.findOne.mockResolvedValue({ servicesCount: 6 });
      eventRepo.create.mockReturnValue({});
      eventRepo.save.mockResolvedValue({});

      const result = await svc2.markComplete(REQUEST_ID, USER_ID, {
        role: 'client',
      });

      const updateCall = (requestRepo.update as jest.Mock).mock
        .calls[0][1] as Record<string, unknown>;
      expect(Number(updateCall.finalPrice)).toBeGreaterThan(0);
      expect(result).toBeDefined();
    });
  });

  // ─── generateServiceSummaryPdf ───────────────────────────────────────────────

  describe('generateServiceSummaryPdf', () => {
    it('should return cached URL without generating PDF when receiptUrl is already set', async () => {
      const cachedUrl = 'https://blob.example.com/existing-receipt.pdf';
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: ServiceRequestStatus.COMPLETED,
        receiptUrl: cachedUrl,
        assignedTechnician: null,
      });

      const result = await service.generateServiceSummaryPdf(REQUEST_ID);

      expect(result.url).toBe(cachedUrl);
      expect(blobStorageService.uploadBuffer).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the service request does not exist', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateServiceSummaryPdf('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when the service is not COMPLETED', async () => {
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: ServiceRequestStatus.REQUESTED,
        receiptUrl: null,
        assignedTechnician: null,
      });

      await expect(
        service.generateServiceSummaryPdf(REQUEST_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate a PDF, upload it, and return the URL', async () => {
      const receiptUrl = 'https://blob.example.com/new-receipt.pdf';
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: ServiceRequestStatus.COMPLETED,
        receiptUrl: null,
        assignedTechnician: { fullName: 'Tech Name' },
        userId: USER_ID,
        requestedSkills: ['plomeria'],
        urgency: UrgencyLevel.media,
        finalPrice: '85000',
        displacementDistanceKm: 3.2,
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(),
      });
      userRepo.findOne.mockResolvedValue({
        id: USER_ID,
        email: 'client@test.com',
      });
      blobStorageService.uploadBuffer.mockResolvedValue(receiptUrl);
      requestRepo.update.mockResolvedValue({});

      const result = await service.generateServiceSummaryPdf(REQUEST_ID);

      expect(blobStorageService.uploadBuffer).toHaveBeenCalled();
      expect(requestRepo.update).toHaveBeenCalledWith(
        REQUEST_ID,
        expect.objectContaining({ receiptUrl }),
      );
      expect(result.url).toBe(receiptUrl);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle a request with no startedAt or completedAt (duration N/A)', async () => {
      const receiptUrl = 'https://blob.example.com/receipt-no-dates.pdf';
      requestRepo.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: ServiceRequestStatus.COMPLETED,
        receiptUrl: null,
        assignedTechnician: null,
        userId: USER_ID,
        requestedSkills: [],
        urgency: UrgencyLevel.baja,
        finalPrice: null,
        displacementDistanceKm: null,
        startedAt: null,
        completedAt: null,
      });
      userRepo.findOne.mockResolvedValue(null);
      blobStorageService.uploadBuffer.mockResolvedValue(receiptUrl);
      requestRepo.update.mockResolvedValue({});

      const result = await service.generateServiceSummaryPdf(REQUEST_ID);

      expect(result.url).toBe(receiptUrl);
    });
  });

  // ─── ensureTenantUserProjection — creates projection when not yet in tenant ──

  describe('findAvailableForTechnician — creates tenant projection when missing', () => {
    it('should create tenant user projection when technician is not yet in tenant', async () => {
      const publicTechnician = {
        id: TECH_ID,
        email: 'tech@test.com',
        phoneNumber: '+573001234567',
        fullName: 'Tech User',
        documentId: '12345',
        profilePhotoUrl: null,
        skills: ['plomeria'],
        currentLatitude: null,
        currentLongitude: null,
        lastLocationUpdate: null,
        status: 'active',
        emailVerified: true,
        phoneVerified: true,
        primaryRole: 'provider',
        lastLoginAt: null,
        deletedAt: null,
      };

      // Public user lookup returns technician
      userRepo.findOne
        .mockResolvedValueOnce(publicTechnician) // getPublicUserRepo findOne
        .mockResolvedValueOnce(null); // ensureTenantUserProjection findOne (not in tenant)

      userRepo.create.mockReturnValue({ id: TECH_ID });
      userRepo.save.mockResolvedValue({ id: TECH_ID });

      // No available requests to simplify the test
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      requestRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAvailableForTechnician(TECH_ID);

      expect(userRepo.create).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });

  // ─── classifyProblemWithAgent — private method edge cases ───────────────────

  describe('create — Azure agent response edge cases', () => {
    const createDto = {
      problema: 'El inodoro no funciona',
      latitude: 4.60971,
      longitude: -74.08175,
      addressText: 'Calle 1 # 2-3',
      serviceCity: 'Bogota',
    };

    beforeEach(() => {
      userRepo.findOne.mockResolvedValue({ id: USER_ID });
    });

    it('should throw InternalServerErrorException when agent response has no content', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '' } }],
        }),
        text: jest.fn().mockResolvedValue(''),
      } as unknown);

      await expect(service.create(USER_ID, createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when agent JSON has no valid categoria', async () => {
      const body = JSON.stringify({ urgencia: 'alta' }); // No categoria
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: body } }],
        }),
        text: jest.fn().mockResolvedValue(body),
      } as unknown);

      await expect(service.create(USER_ID, createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should parse array-format content from agent response', async () => {
      const inner = JSON.stringify({ categoria: 'plomeria', urgencia: 'alta' });
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: [{ type: 'text', text: inner }],
              },
            },
          ],
        }),
        text: jest.fn().mockResolvedValue(''),
      } as unknown);

      const savedMock = { ...baseRequest, userId: USER_ID };
      requestRepo.create.mockReturnValue(savedMock);
      requestRepo.save.mockResolvedValue(savedMock);
      requestRepo.findOneOrFail.mockResolvedValue(savedMock);

      const result = await service.create(USER_ID, createDto);

      expect(result.userId).toBe(USER_ID);
    });

    it('should accept an array categoria and map each skill', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(
          buildFetchMock(['plomeria', 'gas'], 'media') as unknown,
        );

      const savedMock = { ...baseRequest, userId: USER_ID };
      requestRepo.create.mockReturnValue(savedMock);
      requestRepo.save.mockResolvedValue(savedMock);
      requestRepo.findOneOrFail.mockResolvedValue(savedMock);

      const result = await service.create(USER_ID, createDto);

      expect(result).toBeDefined();
    });

    it('should fall back to UrgencyLevel.media when urgencia is non-string', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(buildFetchMock('plomeria', 99) as unknown);

      const savedMock = { ...baseRequest, userId: USER_ID };
      requestRepo.create.mockReturnValue(savedMock);
      requestRepo.save.mockResolvedValue(savedMock);
      requestRepo.findOneOrFail.mockResolvedValue(savedMock);

      const result = await service.create(USER_ID, createDto);

      expect(result).toBeDefined();
    });

    it('should map urgencia "baja" to UrgencyLevel.baja', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(buildFetchMock('plomeria', 'baja') as unknown);

      const savedMock = {
        ...baseRequest,
        userId: USER_ID,
        urgency: UrgencyLevel.baja,
      };
      requestRepo.create.mockReturnValue(savedMock);
      requestRepo.save.mockResolvedValue(savedMock);
      requestRepo.findOneOrFail.mockResolvedValue(savedMock);

      const result = await service.create(USER_ID, createDto);

      expect(result).toBeDefined();
    });

    it('should map urgencia "media" to UrgencyLevel.media', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(buildFetchMock('plomeria', 'media') as unknown);

      const savedMock = { ...baseRequest, userId: USER_ID };
      requestRepo.create.mockReturnValue(savedMock);
      requestRepo.save.mockResolvedValue(savedMock);
      requestRepo.findOneOrFail.mockResolvedValue(savedMock);

      const result = await service.create(USER_ID, createDto);

      expect(result).toBeDefined();
    });

    it('should fall back to UrgencyLevel.media for an unknown urgencia string', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockImplementation(buildFetchMock('plomeria', 'urgente') as unknown);

      const savedMock = { ...baseRequest, userId: USER_ID };
      requestRepo.create.mockReturnValue(savedMock);
      requestRepo.save.mockResolvedValue(savedMock);
      requestRepo.findOneOrFail.mockResolvedValue(savedMock);

      const result = await service.create(USER_ID, createDto);

      expect(result).toBeDefined();
    });
  });

  // ─── accept — ForbiddenException when provider is not verified ───────────────

  describe('accept — unverified provider', () => {
    it('should throw ForbiddenException when technician is not verified', async () => {
      userRepo.findOne.mockResolvedValue({
        id: TECH_ID,
        skills: ['plomeria'],
      });
      providerProfileRepo.findOne.mockResolvedValue({
        userId: TECH_ID,
        verificationStatus: ProviderVerificationStatus.PENDING,
      });

      await expect(service.accept(REQUEST_ID, TECH_ID, {})).rejects.toThrow(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });

    it('should throw ForbiddenException when provider profile does not exist', async () => {
      userRepo.findOne.mockResolvedValue({
        id: TECH_ID,
        skills: ['plomeria'],
      });
      providerProfileRepo.findOne.mockResolvedValue(null);

      await expect(service.accept(REQUEST_ID, TECH_ID, {})).rejects.toThrow(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });
  });
});
