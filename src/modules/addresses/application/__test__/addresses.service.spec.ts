import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AddressEntity } from '@/database/entities';
import { TenantDataSourceService } from '@/tenant';
import { AddressesService } from '../addresses.service';

const makeAddress = (
  overrides: Partial<AddressEntity> = {},
): AddressEntity => ({
  id: 'addr-1',
  userId: 'user-1',
  street: 'Calle 1',
  city: 'Bogotá',
  neighborhood: null,
  department: null,
  country: 'CO',
  postalCode: null,
  label: null,
  latitude: 4.711,
  longitude: -74.072,
  isDefault: false,
  createdAt: new Date(),
  user: {} as never,
  requests: [],
  ...overrides,
});

describe('AddressesService', () => {
  let service: AddressesService;
  let mockRepo: Record<string, jest.Mock>;
  let mockDs: Partial<DataSource>;
  let mockTenantDs: Partial<TenantDataSourceService>;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockDs = {
      getRepository: jest.fn().mockReturnValue(mockRepo),
      transaction: jest.fn(),
    };

    mockTenantDs = {
      getDataSource: jest.fn().mockResolvedValue(mockDs),
    };

    service = new AddressesService(mockTenantDs as TenantDataSourceService);
  });

  describe('findByUser', () => {
    it('returns mapped DTOs for the user', async () => {
      const addr = makeAddress({ isDefault: true });
      mockRepo.find.mockResolvedValue([addr]);

      const result = await service.findByUser('user-1');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { isDefault: 'DESC', createdAt: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('addr-1');
      expect(result[0].city).toBe('Bogotá');
    });

    it('returns empty array when user has no addresses', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.findByUser('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('creates and returns the new address', async () => {
      const created = makeAddress();
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create('user-1', {
        street: 'Calle 1',
        city: 'Bogotá',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          street: 'Calle 1',
          city: 'Bogotá',
          isDefault: false,
        }),
      );
      expect(result.street).toBe('Calle 1');
    });
  });

  describe('setDefault', () => {
    it('updates the default address inside a transaction', async () => {
      const addr = makeAddress();
      const updated = makeAddress({ isDefault: true });
      mockRepo.findOne.mockResolvedValue(addr);
      mockRepo.findOneOrFail.mockResolvedValue(updated);

      const mockEm: Partial<EntityManager> = { update: jest.fn() };
      (mockDs.transaction as jest.Mock).mockImplementation(
        async (cb: (em: EntityManager) => Promise<void>) => {
          await cb(mockEm as EntityManager);
        },
      );

      const result = await service.setDefault('addr-1', 'user-1');

      expect(mockDs.transaction).toHaveBeenCalled();
      expect(mockEm.update).toHaveBeenCalledWith(
        AddressEntity,
        { userId: 'user-1' },
        { isDefault: false },
      );
      expect(mockEm.update).toHaveBeenCalledWith(
        AddressEntity,
        { id: 'addr-1' },
        { isDefault: true },
      );
      expect(result.isDefault).toBe(true);
    });

    it('throws NotFoundException when address does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.setDefault('addr-x', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when address belongs to another user', async () => {
      mockRepo.findOne.mockResolvedValue(makeAddress({ userId: 'user-2' }));
      await expect(service.setDefault('addr-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the address when it belongs to the user', async () => {
      mockRepo.findOne.mockResolvedValue(makeAddress());
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove('addr-1', 'user-1');

      expect(mockRepo.delete).toHaveBeenCalledWith({ id: 'addr-1' });
    });

    it('throws NotFoundException when address does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('addr-x', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when address belongs to another user', async () => {
      mockRepo.findOne.mockResolvedValue(makeAddress({ userId: 'user-2' }));
      await expect(service.remove('addr-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
