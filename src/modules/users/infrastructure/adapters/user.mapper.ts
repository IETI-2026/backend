import {
  User as PrismaUser,
  UserStatus as PrismaUserStatus,
} from '@prisma/client';
import type {
  CreateUserEntity,
  UpdateUserEntity,
  UserEntity,
} from '@users/domain';
import { UserStatus } from '@users/domain';

export function toDomain(prismaUser: PrismaUser): UserEntity {
  return {
    id: prismaUser.id,
    email: prismaUser.email,
    phoneNumber: prismaUser.phoneNumber,
    fullName: prismaUser.fullName,
    documentId: prismaUser.documentId,
    profilePhotoUrl: prismaUser.profilePhotoUrl,
    skills: prismaUser.skills,
    currentLatitude: prismaUser.currentLatitude,
    currentLongitude: prismaUser.currentLongitude,
    lastLocationUpdate: prismaUser.lastLocationUpdate,
    status: prismaUser.status as UserStatus,
    emailVerified: prismaUser.emailVerified,
    phoneVerified: prismaUser.phoneVerified,
    createdAt: prismaUser.createdAt,
    updatedAt: prismaUser.updatedAt,
    lastLoginAt: prismaUser.lastLoginAt,
    deletedAt: prismaUser.deletedAt,
  };
}

export function toPrismaCreate(data: CreateUserEntity) {
  return {
    email: data.email,
    phoneNumber: data.phoneNumber,
    passwordHash: data.passwordHash,
    fullName: data.fullName,
    documentId: data.documentId,
    profilePhotoUrl: data.profilePhotoUrl,
    skills: data.skills,
    currentLatitude: data.currentLatitude,
    currentLongitude: data.currentLongitude,
    lastLocationUpdate: data.lastLocationUpdate,
    status: data.status as PrismaUserStatus | undefined,
  };
}

export function toPrismaUpdate(data: UpdateUserEntity) {
  return {
    email: data.email,
    phoneNumber: data.phoneNumber,
    fullName: data.fullName,
    documentId: data.documentId,
    profilePhotoUrl: data.profilePhotoUrl,
    skills: data.skills,
    currentLatitude: data.currentLatitude,
    currentLongitude: data.currentLongitude,
    lastLocationUpdate: data.lastLocationUpdate,
    status: data.status as PrismaUserStatus | undefined,
    emailVerified: data.emailVerified,
    phoneVerified: data.phoneVerified,
    lastLoginAt: data.lastLoginAt,
  };
}
