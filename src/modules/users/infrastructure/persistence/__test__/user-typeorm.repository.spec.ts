import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserTypeOrmRepository } from '../user-typeorm.repository';
import { TENANT_DATA_SOURCE } from '@/tenant';
import { UserStatus } from '@users/domain';

// ─── shared fixtures ──────────────────────────────────────────────────────────

const now = new Date('2026-01-01T00:00:00.000Z');

const dbUserFixture = {
  id: 'user-uuid-001',
  email: 'test@example.com',
  phoneNumber: '+573001234567',
  passwordHash: 'hashed',
  fullName: 'Test User',
  documentId: null,
  profilePhotoUrl: null,
  skills: [],
  currentLatitude: null,
  currentLongitude: null,
  lastLocationUpdate: null,
  status: 'ACTIVE',
  emailVerified: false,
  phoneVerified: false,
  primaryRole: 'USER',
  createdAt: now,
  updatedAt: now,
  lastLoginAt: null,
  deletedAt: null,
};

// Mock user.mapper so we control what toDomain returns without needing DB entities
jest.mock('../../adapters/user.mapper', () => ({
  toCreateData: jest.fn((data: unknown) => data),
  toUpdateData: jest.fn((data: unknown) => data),
  toDomain: jest.fn((entity: { id: string; email: string | null; phoneNumber: string | null; fullName: string; documentId: string | null; profilePhotoUrl: string | null; skills: string[]; currentLatitude: number | null; currentLongitude: number | null; lastLocationUpdate: Date | null; status: string; emailVerified: boolean; phoneVerified: boolean; createdAt: Date; updatedAt: Date; lastLoginAt: Date | null; deletedAt: Date | null }) => ({
    id: entity.id,
    email: entity.email,
    phoneNumber: entity.phoneNumber,
    fullName: entity.fullName,
    documentId: entity.documentId,
    profilePhotoUrl: entity.profilePhotoUrl,
    skills: entity.skills,
    currentLatitude: entity.currentLatitude,
    currentLongitude: entity.currentLongitude,
    lastLocationUpdate: entity.lastLocationUpdate,
    status: entity.status as UserStatus,
    emailVerified: entity.emailVerified,
    phoneVerified: entity.phoneVerified,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    lastLoginAt: entity.lastLoginAt,
    deletedAt: entity.deletedAt,
  })),
}));

describe('UserTypeOrmRepository', () => {
  let repository: UserTypeOrmRepository;

  // Typed mock for the TypeORM repository methods we call
  const mockTypeOrmRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockTypeOrmRepo),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTypeOrmRepository,
        {
          provide: TENANT_DATA_SOURCE,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    repository = module.get<UserTypeOrmRepository>(UserTypeOrmRepository);
    jest.clearAllMocks();
    // Re-wire the mock after clearAllMocks resets call counts but preserves implementations
    mockDataSource.getRepository.mockReturnValue(mockTypeOrmRepo);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a domain user entity', async () => {
      mockTypeOrmRepo.create.mockReturnValue(dbUserFixture);
      mockTypeOrmRepo.save.mockResolvedValue(dbUserFixture);

      const result = await repository.create({
        fullName: 'Test User',
        email: 'test@example.com',
      });

      expect(mockTypeOrmRepo.create).toHaveBeenCalled();
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('user-uuid-001');
      expect(result.email).toBe('test@example.com');
    });

    it('should propagate save errors', async () => {
      mockTypeOrmRepo.create.mockReturnValue(dbUserFixture);
      mockTypeOrmRepo.save.mockRejectedValue(new Error('DB write error'));

      await expect(
        repository.create({ fullName: 'Test', email: 'test@example.com' }),
      ).rejects.toThrow('DB write error');
    });
  });

  // ─── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return a domain user when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(dbUserFixture);

      const result = await repository.findById('user-uuid-001');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid-001' },
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe('user-uuid-001');
    });

    it('should return null when user does not exist', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ─── findByEmail ─────────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('should return a domain user when email matches', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(dbUserFixture);

      const result = await repository.findByEmail('test@example.com');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result!.email).toBe('test@example.com');
    });

    it('should return null when email is not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });

  // ─── findByPhoneNumber ────────────────────────────────────────────────────────

  describe('findByPhoneNumber', () => {
    it('should return a domain user when phone matches', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(dbUserFixture);

      const result = await repository.findByPhoneNumber('+573001234567');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: '+573001234567' },
      });
      expect(result).not.toBeNull();
    });

    it('should return null when phone is not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByPhoneNumber('+570000000000');

      expect(result).toBeNull();
    });
  });

  // ─── findByDocumentId ────────────────────────────────────────────────────────

  describe('findByDocumentId', () => {
    it('should return a domain user when documentId matches', async () => {
      const withDoc = { ...dbUserFixture, documentId: 'DOC-123' };
      mockTypeOrmRepo.findOne.mockResolvedValue(withDoc);

      const result = await repository.findByDocumentId('DOC-123');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { documentId: 'DOC-123' },
      });
      expect(result).not.toBeNull();
    });

    it('should return null when documentId is not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByDocumentId('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated users with no status filter', async () => {
      mockTypeOrmRepo.findAndCount.mockResolvedValue([[dbUserFixture], 1]);

      const result = await repository.findAll({ skip: 0, take: 10 });

      expect(mockTypeOrmRepo.findAndCount).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      });
      expect(result.total).toBe(1);
      expect(result.users).toHaveLength(1);
    });

    it('should apply status filter when provided', async () => {
      mockTypeOrmRepo.findAndCount.mockResolvedValue([[dbUserFixture], 1]);

      await repository.findAll({ skip: 0, take: 10, status: 'ACTIVE' });

      expect(mockTypeOrmRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
        }),
      );
    });

    it('should use default skip and take when not provided', async () => {
      mockTypeOrmRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await repository.findAll({});

      expect(mockTypeOrmRepo.findAndCount).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      });
      expect(result.total).toBe(0);
      expect(result.users).toHaveLength(0);
    });

    it('should propagate database errors', async () => {
      mockTypeOrmRepo.findAndCount.mockRejectedValue(new Error('DB error'));

      await expect(repository.findAll({})).rejects.toThrow('DB error');
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update and return the updated user', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOneOrFail.mockResolvedValue({
        ...dbUserFixture,
        fullName: 'Updated Name',
      });

      const result = await repository.update('user-uuid-001', { fullName: 'Updated Name' });

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        'user-uuid-001',
        expect.any(Object),
      );
      expect(mockTypeOrmRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 'user-uuid-001' },
      });
      expect(result.fullName).toBe('Updated Name');
    });

    it('should throw NotFoundException when user to update does not exist', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 0 });

      await expect(
        repository.update('non-existent', { fullName: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should hard delete the user', async () => {
      mockTypeOrmRepo.delete.mockResolvedValue({ affected: 1 });

      await repository.delete('user-uuid-001');

      expect(mockTypeOrmRepo.delete).toHaveBeenCalledWith('user-uuid-001');
    });

    it('should throw NotFoundException when user to delete does not exist', async () => {
      mockTypeOrmRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(repository.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── softDelete ───────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should soft-delete the user and return the updated entity', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOneOrFail.mockResolvedValue({
        ...dbUserFixture,
        status: 'DELETED',
        deletedAt: now,
      });

      const result = await repository.softDelete('user-uuid-001');

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        'user-uuid-001',
        expect.objectContaining({ status: 'DELETED' }),
      );
      expect(result.status).toBe('DELETED' as UserStatus);
    });

    it('should throw NotFoundException when user to soft-delete does not exist', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 0 });

      await expect(repository.softDelete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── exists ──────────────────────────────────────────────────────────────────

  describe('exists', () => {
    it('should return true when user exists', async () => {
      mockTypeOrmRepo.count.mockResolvedValue(1);

      const result = await repository.exists('user-uuid-001');

      expect(mockTypeOrmRepo.count).toHaveBeenCalledWith({
        where: { id: 'user-uuid-001' },
      });
      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      mockTypeOrmRepo.count.mockResolvedValue(0);

      const result = await repository.exists('non-existent');

      expect(result).toBe(false);
    });
  });
});
