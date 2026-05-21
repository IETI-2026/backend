import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ServiceRequestStatus,
  UrgencyLevel,
} from '../../../../../database/enums';
import { JwtPayloadEntity } from '../../../../auth/domain/entities';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import {
  ChooseTechnicianDto,
  CreateServiceRequestDto,
  MarkCompleteDto,
  RateServiceRequestDto,
  ServiceRequestsService,
  UpdateLocationDto,
} from '../../../application';
import { ServiceRequestsController } from '../service-requests.controller';

const mockServiceRequest = {
  id: 'req-uuid-001',
  userId: 'user-uuid-001',
  status: ServiceRequestStatus.REQUESTED,
  problemDescription: 'My sink is leaking',
  urgency: UrgencyLevel.media,
  serviceCity: 'Bogota',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockAcceptedTechnician = {
  id: 'tech-uuid-001',
  fullName: 'Tech One',
  email: 'tech@example.com',
};

const mockServiceRequestsService = {
  findAll: jest.fn(),
  findAcceptedTechnicians: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findAvailableForTechnician: jest.fn(),
  accept: jest.fn(),
  reject: jest.fn(),
  chooseTechnician: jest.fn(),
  markComplete: jest.fn(),
  updateUserLocation: jest.fn(),
  generateServiceSummaryPdf: jest.fn(),
  rateService: jest.fn(),
};

const allowAllGuard = { canActivate: () => true };

describe('ServiceRequestsController', () => {
  let controller: ServiceRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceRequestsController],
      providers: [
        {
          provide: ServiceRequestsService,
          useValue: mockServiceRequestsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .compile();

    controller = module.get<ServiceRequestsController>(
      ServiceRequestsController,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return a paginated list of service requests', async () => {
      const paginatedResult = {
        requests: [mockServiceRequest],
        total: 1,
        page: 0,
        limit: 20,
      };
      mockServiceRequestsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({} as unknown);

      expect(mockServiceRequestsService.findAll).toHaveBeenCalledWith({});
      expect(result.total).toBe(1);
      expect(result.requests).toHaveLength(1);
    });

    it('should pass query filters to the service', async () => {
      const query = {
        status: ServiceRequestStatus.REQUESTED,
        userId: 'user-uuid-001',
        page: 0,
        limit: 10,
      } as unknown;
      mockServiceRequestsService.findAll.mockResolvedValue({
        requests: [],
        total: 0,
        page: 0,
        limit: 10,
      });

      await controller.findAll(query);

      expect(mockServiceRequestsService.findAll).toHaveBeenCalledWith(query);
    });

    it('should propagate service errors', async () => {
      mockServiceRequestsService.findAll.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(controller.findAll({} as unknown)).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('findAcceptedTechnicians', () => {
    it('should return technicians who accepted a request', async () => {
      mockServiceRequestsService.findAcceptedTechnicians.mockResolvedValue([
        mockAcceptedTechnician,
      ]);

      const result = await controller.findAcceptedTechnicians('req-uuid-001');

      expect(
        mockServiceRequestsService.findAcceptedTechnicians,
      ).toHaveBeenCalledWith('req-uuid-001');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tech-uuid-001');
    });

    it('should return an empty array when no technicians have accepted', async () => {
      mockServiceRequestsService.findAcceptedTechnicians.mockResolvedValue([]);

      const result = await controller.findAcceptedTechnicians('req-uuid-001');

      expect(result).toHaveLength(0);
    });

    it('should propagate NotFoundException for unknown request ID', async () => {
      mockServiceRequestsService.findAcceptedTechnicians.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(
        controller.findAcceptedTechnicians('bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = {
      userId: 'user-uuid-001',
      problemDescription: 'Leaking sink',
      serviceCity: 'Bogota',
    };

    it('should create and return a new service request', async () => {
      mockServiceRequestsService.create.mockResolvedValue(mockServiceRequest);

      const result = await controller.create(
        { sub: 'user-uuid-001' } as JwtPayloadEntity,
        createDto as unknown as CreateServiceRequestDto,
      );

      expect(mockServiceRequestsService.create).toHaveBeenCalledWith(
        'user-uuid-001',
        createDto,
      );
      expect(result).toBe(mockServiceRequest);
    });

    it('should propagate NotFoundException when the client user does not exist', async () => {
      mockServiceRequestsService.create.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.create(
          { sub: 'user-uuid-001' } as JwtPayloadEntity,
          createDto as unknown as CreateServiceRequestDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException for invalid input', async () => {
      mockServiceRequestsService.create.mockRejectedValue(
        new BadRequestException('Validation failed'),
      );

      await expect(
        controller.create(
          { sub: 'user-uuid-001' } as JwtPayloadEntity,
          {} as unknown as CreateServiceRequestDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAvailableForTechnician', () => {
    it('should return available requests matching the technician skills', async () => {
      mockServiceRequestsService.findAvailableForTechnician.mockResolvedValue([
        mockServiceRequest,
      ]);

      const result =
        await controller.findAvailableForTechnician('tech-uuid-001');

      expect(
        mockServiceRequestsService.findAvailableForTechnician,
      ).toHaveBeenCalledWith('tech-uuid-001');
      expect(result).toHaveLength(1);
    });

    it('should return an empty array when no matching requests exist', async () => {
      mockServiceRequestsService.findAvailableForTechnician.mockResolvedValue(
        [],
      );

      const result =
        await controller.findAvailableForTechnician('tech-uuid-001');

      expect(result).toHaveLength(0);
    });

    it('should propagate NotFoundException for unknown technician', async () => {
      mockServiceRequestsService.findAvailableForTechnician.mockRejectedValue(
        new NotFoundException('Technician not found'),
      );

      await expect(
        controller.findAvailableForTechnician('bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('accept', () => {
    const acceptDto = { technicianUserId: 'tech-uuid-001' };

    it('should register a technician acceptance and return the updated request', async () => {
      const accepted = {
        ...mockServiceRequest,
        status: ServiceRequestStatus.REQUESTED,
      };
      mockServiceRequestsService.accept.mockResolvedValue(accepted);

      const result = await controller.accept(
        { sub: 'tech-uuid-001' } as JwtPayloadEntity,
        'req-uuid-001',
      );

      expect(mockServiceRequestsService.accept).toHaveBeenCalledWith(
        'req-uuid-001',
        'tech-uuid-001',
        {},
      );
      expect(result).toBe(accepted);
    });

    it('should propagate ConflictException when request is no longer available', async () => {
      mockServiceRequestsService.accept.mockRejectedValue(
        new ConflictException('Request already assigned'),
      );

      await expect(
        controller.accept('req-uuid-001', acceptDto as unknown),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate NotFoundException for unknown request or technician', async () => {
      mockServiceRequestsService.accept.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(
        controller.accept('bad-id', acceptDto as unknown),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    const rejectDto = {
      technicianUserId: 'tech-uuid-001',
      reason: 'Too far away',
    };

    it('should register a technician rejection and return a message', async () => {
      mockServiceRequestsService.reject.mockResolvedValue({
        message:
          'Service request req-uuid-001 rejected by technician tech-uuid-001',
      });

      const result = await controller.reject(
        'req-uuid-001',
        rejectDto as unknown,
      );

      expect(mockServiceRequestsService.reject).toHaveBeenCalledWith(
        'req-uuid-001',
        rejectDto,
      );
      expect(result.message).toContain('rejected');
    });

    it('should propagate ConflictException when request cannot be rejected in its current state', async () => {
      mockServiceRequestsService.reject.mockRejectedValue(
        new ConflictException('Cannot reject request in COMPLETED state'),
      );

      await expect(
        controller.reject('req-uuid-001', rejectDto as unknown),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate NotFoundException for unknown IDs', async () => {
      mockServiceRequestsService.reject.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(
        controller.reject('bad-id', rejectDto as unknown),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('chooseTechnician', () => {
    const chooseDto = {
      userId: 'user-uuid-001',
      technicianUserId: 'tech-uuid-001',
    };

    it('should assign the chosen technician and return the updated request', async () => {
      const assigned = {
        ...mockServiceRequest,
        status: ServiceRequestStatus.ASSIGNED,
      };
      mockServiceRequestsService.chooseTechnician.mockResolvedValue(assigned);

      const result = await controller.chooseTechnician(
        { sub: 'user-uuid-001' } as JwtPayloadEntity,
        'req-uuid-001',
        { technicianUserId: 'tech-uuid-001' } as unknown as ChooseTechnicianDto,
      );

      expect(mockServiceRequestsService.chooseTechnician).toHaveBeenCalledWith(
        'req-uuid-001',
        'user-uuid-001',
        { technicianUserId: 'tech-uuid-001' },
      );
      expect(result.status).toBe(ServiceRequestStatus.ASSIGNED);
    });

    it('should propagate ConflictException when the client does not own the request', async () => {
      mockServiceRequestsService.chooseTechnician.mockRejectedValue(
        new ConflictException('User is not the owner of this request'),
      );

      await expect(
        controller.chooseTechnician('req-uuid-001', chooseDto as unknown),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate ConflictException when technician never accepted the request', async () => {
      mockServiceRequestsService.chooseTechnician.mockRejectedValue(
        new ConflictException('Technician did not accept this request'),
      );

      await expect(
        controller.chooseTechnician('req-uuid-001', chooseDto as unknown),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate NotFoundException for unknown request', async () => {
      mockServiceRequestsService.chooseTechnician.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(
        controller.chooseTechnician('bad-id', chooseDto as unknown),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return a single service request by ID', async () => {
      mockServiceRequestsService.findById.mockResolvedValue(mockServiceRequest);

      const result = await controller.findById('req-uuid-001');

      expect(mockServiceRequestsService.findById).toHaveBeenCalledWith(
        'req-uuid-001',
      );
      expect(result).toBe(mockServiceRequest);
    });

    it('should propagate NotFoundException for an unknown ID', async () => {
      mockServiceRequestsService.findById.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(controller.findById('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markComplete', () => {
    const markDto: MarkCompleteDto = { role: 'client' };

    it('should mark the service complete and return the updated request', async () => {
      mockServiceRequestsService.markComplete.mockResolvedValue(
        mockServiceRequest,
      );

      const result = await controller.markComplete(
        { sub: 'user-uuid-001' } as JwtPayloadEntity,
        'req-uuid-001',
        markDto,
      );

      expect(mockServiceRequestsService.markComplete).toHaveBeenCalledWith(
        'req-uuid-001',
        'user-uuid-001',
        markDto,
      );
      expect(result).toBe(mockServiceRequest);
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      await expect(
        controller.markComplete(
          {} as JwtPayloadEntity,
          'req-uuid-001',
          markDto,
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockServiceRequestsService.markComplete).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException when the request does not exist', async () => {
      mockServiceRequestsService.markComplete.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(
        controller.markComplete(
          { sub: 'user-uuid-001' } as JwtPayloadEntity,
          'bad-id',
          markDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLocation', () => {
    const locationDto: UpdateLocationDto = {
      latitude: 4.711,
      longitude: -74.072,
    };

    it('should update the user location and return a success message', async () => {
      mockServiceRequestsService.updateUserLocation.mockResolvedValue(
        undefined,
      );

      const result = await controller.updateLocation(
        { sub: 'user-uuid-001' } as JwtPayloadEntity,
        'req-uuid-001',
        locationDto,
      );

      expect(
        mockServiceRequestsService.updateUserLocation,
      ).toHaveBeenCalledWith(
        'user-uuid-001',
        locationDto.latitude,
        locationDto.longitude,
      );
      expect(result).toEqual({ message: 'Location updated' });
    });

    it('should throw UnauthorizedException when user has no sub', async () => {
      await expect(
        controller.updateLocation(
          {} as JwtPayloadEntity,
          'req-uuid-001',
          locationDto,
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(
        mockServiceRequestsService.updateUserLocation,
      ).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      mockServiceRequestsService.updateUserLocation.mockRejectedValue(
        new Error('Location service error'),
      );

      await expect(
        controller.updateLocation(
          { sub: 'user-uuid-001' } as JwtPayloadEntity,
          'req-uuid-001',
          locationDto,
        ),
      ).rejects.toThrow('Location service error');
    });
  });

  describe('getReceipt', () => {
    it('should return the receipt URL for a completed service', async () => {
      const receiptUrl = 'https://blob.example.com/receipt.pdf';
      mockServiceRequestsService.generateServiceSummaryPdf.mockResolvedValue({
        url: receiptUrl,
        buffer: Buffer.alloc(0),
      });

      const result = await controller.getReceipt('req-uuid-001');

      expect(
        mockServiceRequestsService.generateServiceSummaryPdf,
      ).toHaveBeenCalledWith('req-uuid-001');
      expect(result).toEqual({ url: receiptUrl });
    });

    it('should propagate NotFoundException when the request does not exist', async () => {
      mockServiceRequestsService.generateServiceSummaryPdf.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(controller.getReceipt('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate BadRequestException when the service is not completed', async () => {
      mockServiceRequestsService.generateServiceSummaryPdf.mockRejectedValue(
        new BadRequestException(
          'Service summary can only be generated for completed services',
        ),
      );

      await expect(controller.getReceipt('req-uuid-001')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('rate', () => {
    const rateDto: RateServiceRequestDto = {
      serviceRating: 5,
      technicianRating: 4,
      comment: 'Excellent service',
    };

    it('should rate the service and return the updated request', async () => {
      const rated = { ...mockServiceRequest, isRated: true };
      mockServiceRequestsService.rateService.mockResolvedValue(rated);

      const result = await controller.rate('req-uuid-001', rateDto);

      expect(mockServiceRequestsService.rateService).toHaveBeenCalledWith(
        'req-uuid-001',
        rateDto,
      );
      expect(result).toBe(rated);
    });

    it('should propagate NotFoundException when the request does not exist', async () => {
      mockServiceRequestsService.rateService.mockRejectedValue(
        new NotFoundException('Request not found'),
      );

      await expect(controller.rate('bad-id', rateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate BadRequestException when the service is not completed', async () => {
      mockServiceRequestsService.rateService.mockRejectedValue(
        new BadRequestException('Service is not completed'),
      );

      await expect(controller.rate('req-uuid-001', rateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate ConflictException when service is already rated', async () => {
      mockServiceRequestsService.rateService.mockRejectedValue(
        new ConflictException('Service already rated'),
      );

      await expect(controller.rate('req-uuid-001', rateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
