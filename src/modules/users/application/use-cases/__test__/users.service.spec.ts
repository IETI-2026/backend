import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { IUserRepository } from '@users/domain';
import { USER_REPOSITORY, UserStatus } from '@users/domain';
import { TenantDataSourceService } from '@/tenant';
import { BlobStorageService } from '../../../../../common/services/blob-storage.service';
import type { CreateUserDto, UpdateUserDto } from '../../dtos';
import { UsersService } from '../users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<IUserRepository>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    phoneNumber: '+573001234567',
    fullName: 'Test User',
    documentId: '1234567890',
    profilePhotoUrl: 'https://example.com/photo.jpg',
    status: UserStatus.ACTIVE,
    emailVerified: false,
    phoneVerified: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastLoginAt: null,
    deletedAt: null,
  };

  const mockUserRepository: jest.Mocked<IUserRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByPhoneNumber: jest.fn(),
    findByDocumentId: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    softDelete: jest.fn(),
    exists: jest.fn(),
  };

  const mockBlobStorageService: jest.Mocked<
    Pick<BlobStorageService, 'uploadFile'>
  > = {
    uploadFile: jest.fn(),
  };

  const mockTenantDataSourceService: jest.Mocked<
    Pick<TenantDataSourceService, 'getDataSource'>
  > = {
    getDataSource: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository,
        },
        {
          provide: BlobStorageService,
          useValue: mockBlobStorageService,
        },
        {
          provide: TenantDataSourceService,
          useValue: mockTenantDataSourceService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(USER_REPOSITORY);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      const createUserDto: CreateUserDto = {
        email: 'newuser@example.com',
        phoneNumber: '+573001234567',
        fullName: 'New User',
        documentId: '9876543210',
        status: UserStatus.ACTIVE,
      };

      repository.findByEmail.mockResolvedValue(null);
      repository.findByPhoneNumber.mockResolvedValue(null);
      repository.findByDocumentId.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(repository.create).toHaveBeenCalledWith(createUserDto);
      expect(result.id).toBe(mockUser.id);
    });

    it('should throw ConflictException when email exists', async () => {
      repository.findByEmail.mockResolvedValue(mockUser);

      const createUserDto: CreateUserDto = {
        email: 'existing@example.com',
        fullName: 'Test User',
      };

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when phone number exists', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.findByPhoneNumber.mockResolvedValue(mockUser);

      const createUserDto: CreateUserDto = {
        phoneNumber: '+573001234567',
        fullName: 'Test User',
      };

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when document ID exists', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.findByPhoneNumber.mockResolvedValue(null);
      repository.findByDocumentId.mockResolvedValue(mockUser);

      const createUserDto: CreateUserDto = {
        documentId: '1234567890',
        fullName: 'Test User',
      };

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a user when found', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      repository.findById.mockResolvedValue(mockUser);

      const result = await service.findOne(userId);

      expect(repository.findById).toHaveBeenCalledWith(userId);
      expect(result.id).toBe(mockUser.id);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const updateUserDto: UpdateUserDto = {
        fullName: 'Updated Name',
        profilePhotoUrl: 'https://example.com/new-photo.jpg',
      };

      const updatedUser = {
        ...mockUser,
        ...updateUserDto,
        updatedAt: new Date('2024-01-02'),
      };

      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue(updatedUser);

      const result = await service.update(userId, updateUserDto);

      expect(repository.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(result.fullName).toBe(updateUserDto.fullName);
    });

    it('should throw NotFoundException when updating non-existent user', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        service.update('non-existent', { fullName: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating to an existing email', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const anotherUser = { ...mockUser, id: 'different-id' };

      repository.findById.mockResolvedValue(mockUser);
      repository.findByEmail.mockResolvedValue(anotherUser);

      await expect(
        service.update(userId, { email: 'existing@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should soft delete a user successfully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      repository.findById.mockResolvedValue(mockUser);
      repository.softDelete.mockResolvedValue({
        ...mockUser,
        status: UserStatus.DELETED,
      });

      await service.remove(userId);

      expect(repository.softDelete).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when soft deleting non-existent user', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const query = {
        page: 0,
        limit: 10,
        status: UserStatus.ACTIVE,
      };

      const mockUsers = [mockUser, { ...mockUser, id: 'another-id' }];
      repository.findAll.mockResolvedValue({
        users: mockUsers,
        total: 2,
      });

      const result = await service.findAll(query);

      expect(repository.findAll).toHaveBeenCalled();
      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('findByEmail', () => {
    it('should return a user when found by email', async () => {
      const email = 'test@example.com';
      repository.findByEmail.mockResolvedValue(mockUser);

      const result = await service.findByEmail(email);

      expect(repository.findByEmail).toHaveBeenCalledWith(email);
      expect(result.id).toBe(mockUser.id);
    });

    it('should throw NotFoundException when user not found by email', async () => {
      repository.findByEmail.mockResolvedValue(null);
      await expect(
        service.findByEmail('nonexistent@example.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('hardDelete', () => {
    it('should hard delete a user successfully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      repository.findById.mockResolvedValue(mockUser);
      repository.delete.mockResolvedValue(undefined);

      await service.hardDelete(userId);

      expect(repository.delete).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when hard deleting non-existent user', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.hardDelete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('uploadProfilePhoto', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'photo.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-image'),
      size: 10,
      stream: null as unknown,
      destination: '',
      filename: 'photo.jpg',
      path: '',
    };

    it('should upload photo and return updated user response', async () => {
      const userId = mockUser.id;
      const photoUrl = 'https://storage.example.com/photo.jpg';

      repository.findById.mockResolvedValue(mockUser);
      (mockBlobStorageService.uploadFile as jest.Mock).mockResolvedValue(
        photoUrl,
      );
      repository.update.mockResolvedValue({
        ...mockUser,
        profilePhotoUrl: photoUrl,
      });

      const result = await service.uploadProfilePhoto(userId, mockFile);

      expect(mockBlobStorageService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        mockUser.email,
      );
      expect(result.id).toBe(userId);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.uploadProfilePhoto('nonexistent', mockFile),
      ).rejects.toThrow(NotFoundException);

      expect(mockBlobStorageService.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('updateLocation', () => {
    it('should update location in both tenant and public datasource', async () => {
      const userId = mockUser.id;
      const latitude = 4.711;
      const longitude = -74.0721;

      const mockPublicRepo = {
        update: jest.fn().mockResolvedValue({}),
      };
      const mockPublicDataSource = {
        getRepository: jest.fn().mockReturnValue(mockPublicRepo),
      };
      (
        mockTenantDataSourceService.getDataSource as jest.Mock
      ).mockResolvedValue(mockPublicDataSource);
      repository.update.mockResolvedValue({
        ...mockUser,
        currentLatitude: latitude,
      });

      await service.updateLocation(userId, latitude, longitude);

      expect(repository.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          currentLatitude: latitude,
          currentLongitude: longitude,
        }),
      );
      expect(mockPublicRepo.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          currentLatitude: latitude,
          currentLongitude: longitude,
        }),
      );
    });
  });

  describe('update — location fields', () => {
    it('should add lastLocationUpdate when coordinates are provided', async () => {
      const userId = mockUser.id;
      const updateDto = { currentLatitude: 4.711, currentLongitude: -74.0721 };

      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue({
        ...mockUser,
        ...updateDto,
      });

      await service.update(userId, updateDto);

      expect(repository.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          currentLatitude: 4.711,
          lastLocationUpdate: expect.any(Date),
        }),
      );
    });

    it('should throw ConflictException when phone number is already taken by another user', async () => {
      const userId = mockUser.id;
      const anotherUser = { ...mockUser, id: 'another-id' };

      repository.findById.mockResolvedValue(mockUser);
      repository.findByPhoneNumber.mockResolvedValue(anotherUser);

      await expect(
        service.update(userId, { phoneNumber: '+573009999999' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
