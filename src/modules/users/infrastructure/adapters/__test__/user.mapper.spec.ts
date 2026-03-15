import { toDomain, toCreateData, toUpdateData } from '../user.mapper';
import { UserEntity as DbUserEntity } from '@/database/entities';
import { UserStatus as DbUserStatus, RoleName } from '@/database/enums';
import { UserStatus } from '@users/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbUser(partial: Partial<DbUserEntity> = {}): DbUserEntity {
  return {
    id: 'user-1',
    email: 'test@example.com',
    phoneNumber: '+57123',
    fullName: 'Test User',
    passwordHash: 'hash',
    documentId: 'DOC-001',
    profilePhotoUrl: 'https://cdn.example.com/photo.jpg',
    skills: ['plumbing', 'electrical'],
    currentLatitude: 4.6097,
    currentLongitude: -74.0817,
    lastLocationUpdate: new Date('2025-01-01T00:00:00.000Z'),
    status: DbUserStatus.ACTIVE,
    emailVerified: true,
    phoneVerified: false,
    primaryRole: RoleName.USER,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-06-01T00:00:00.000Z'),
    lastLoginAt: new Date('2025-03-01T00:00:00.000Z'),
    deletedAt: null,
    // Relations (not mapped by toDomain)
    roles: [],
    oauthAccounts: [],
    refreshTokens: [],
    passwordResetTokens: [],
    otpCodes: [],
    providerProfile: null as any,
    addresses: [],
    serviceRequests: [],
    assignedRequests: [],
    payments: [],
    ratingsGiven: [],
    ratingsReceived: [],
    notifications: [],
    auditLogs: [],
    chatMessages: [],
    subscriptions: [],
    technicianResponses: [],
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// toDomain
// ---------------------------------------------------------------------------

describe('toDomain', () => {
  it('maps all scalar fields correctly', () => {
    const dbUser = makeDbUser();
    const domain = toDomain(dbUser);

    expect(domain.id).toBe('user-1');
    expect(domain.email).toBe('test@example.com');
    expect(domain.phoneNumber).toBe('+57123');
    expect(domain.fullName).toBe('Test User');
    expect(domain.documentId).toBe('DOC-001');
    expect(domain.profilePhotoUrl).toBe('https://cdn.example.com/photo.jpg');
    expect(domain.skills).toEqual(['plumbing', 'electrical']);
    expect(domain.currentLatitude).toBe(4.6097);
    expect(domain.currentLongitude).toBe(-74.0817);
    expect(domain.status).toBe(UserStatus.ACTIVE);
    expect(domain.emailVerified).toBe(true);
    expect(domain.phoneVerified).toBe(false);
    expect(domain.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    expect(domain.updatedAt).toEqual(new Date('2024-06-01T00:00:00.000Z'));
    expect(domain.lastLoginAt).toEqual(new Date('2025-03-01T00:00:00.000Z'));
    expect(domain.deletedAt).toBeNull();
  });

  it('maps nullable fields as null when absent', () => {
    const dbUser = makeDbUser({
      email: null,
      phoneNumber: null,
      documentId: null,
      profilePhotoUrl: null,
      currentLatitude: null,
      currentLongitude: null,
      lastLocationUpdate: null,
      lastLoginAt: null,
      deletedAt: null,
    });
    const domain = toDomain(dbUser);

    expect(domain.email).toBeNull();
    expect(domain.phoneNumber).toBeNull();
    expect(domain.documentId).toBeNull();
    expect(domain.profilePhotoUrl).toBeNull();
    expect(domain.currentLatitude).toBeNull();
    expect(domain.currentLongitude).toBeNull();
    expect(domain.lastLocationUpdate).toBeNull();
    expect(domain.lastLoginAt).toBeNull();
    expect(domain.deletedAt).toBeNull();
  });

  it('preserves empty skills array', () => {
    const dbUser = makeDbUser({ skills: [] });
    const domain = toDomain(dbUser);
    expect(domain.skills).toEqual([]);
  });

  it('casts db UserStatus to domain UserStatus', () => {
    const dbUser = makeDbUser({ status: DbUserStatus.SUSPENDED });
    const domain = toDomain(dbUser);
    expect(domain.status).toBe(UserStatus.SUSPENDED);
  });

  it('does not include ORM-specific relation fields in the domain object', () => {
    const dbUser = makeDbUser();
    const domain = toDomain(dbUser);

    expect((domain as any).roles).toBeUndefined();
    expect((domain as any).refreshTokens).toBeUndefined();
    expect((domain as any).passwordHash).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// toCreateData
// ---------------------------------------------------------------------------

describe('toCreateData', () => {
  it('maps all create fields', () => {
    const input = {
      email: 'new@example.com',
      phoneNumber: '+57999',
      passwordHash: 'hashed-pw',
      fullName: 'New User',
      documentId: 'DOC-999',
      profilePhotoUrl: 'https://photo.url',
      skills: ['cooking'],
      currentLatitude: 1.0,
      currentLongitude: 2.0,
      lastLocationUpdate: new Date('2025-01-15T00:00:00.000Z'),
      status: UserStatus.ACTIVE,
    };

    const result = toCreateData(input);

    expect(result.email).toBe('new@example.com');
    expect(result.phoneNumber).toBe('+57999');
    expect(result.passwordHash).toBe('hashed-pw');
    expect(result.fullName).toBe('New User');
    expect(result.documentId).toBe('DOC-999');
    expect(result.profilePhotoUrl).toBe('https://photo.url');
    expect(result.skills).toEqual(['cooking']);
    expect(result.currentLatitude).toBe(1.0);
    expect(result.currentLongitude).toBe(2.0);
    expect(result.status).toBe(DbUserStatus.ACTIVE);
  });

  it('handles undefined optional fields', () => {
    const input = { fullName: 'Minimal' };
    const result = toCreateData(input);

    expect(result.email).toBeUndefined();
    expect(result.phoneNumber).toBeUndefined();
    expect(result.passwordHash).toBeUndefined();
    expect(result.documentId).toBeUndefined();
    expect(result.profilePhotoUrl).toBeUndefined();
    expect(result.skills).toBeUndefined();
    expect(result.currentLatitude).toBeUndefined();
    expect(result.currentLongitude).toBeUndefined();
    expect(result.status).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// toUpdateData
// ---------------------------------------------------------------------------

describe('toUpdateData', () => {
  it('maps all update fields', () => {
    const input = {
      email: 'updated@example.com',
      phoneNumber: '+57000',
      fullName: 'Updated User',
      documentId: 'DOC-UPD',
      profilePhotoUrl: 'https://new-photo.url',
      skills: ['carpentry'],
      currentLatitude: 5.0,
      currentLongitude: -75.0,
      lastLocationUpdate: new Date('2025-03-10T00:00:00.000Z'),
      status: UserStatus.INACTIVE,
      emailVerified: true,
      phoneVerified: true,
      lastLoginAt: new Date('2025-03-15T00:00:00.000Z'),
    };

    const result = toUpdateData(input);

    expect(result.email).toBe('updated@example.com');
    expect(result.phoneNumber).toBe('+57000');
    expect(result.fullName).toBe('Updated User');
    expect(result.documentId).toBe('DOC-UPD');
    expect(result.profilePhotoUrl).toBe('https://new-photo.url');
    expect(result.skills).toEqual(['carpentry']);
    expect(result.currentLatitude).toBe(5.0);
    expect(result.currentLongitude).toBe(-75.0);
    expect(result.status).toBe(DbUserStatus.INACTIVE);
    expect(result.emailVerified).toBe(true);
    expect(result.phoneVerified).toBe(true);
    expect(result.lastLoginAt).toEqual(new Date('2025-03-15T00:00:00.000Z'));
  });

  it('handles all undefined optional fields', () => {
    const result = toUpdateData({});

    expect(result.email).toBeUndefined();
    expect(result.fullName).toBeUndefined();
    expect(result.skills).toBeUndefined();
    expect(result.emailVerified).toBeUndefined();
    expect(result.phoneVerified).toBeUndefined();
    expect(result.lastLoginAt).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it('casts UserStatus DELETED to DbUserStatus', () => {
    const result = toUpdateData({ status: UserStatus.DELETED });
    expect(result.status).toBe(DbUserStatus.DELETED);
  });
});
