// ============================================================
// Enums de base de datos — reemplazan los generados por @prisma/client
// ============================================================

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
  DELETED = "DELETED",
}

export enum ProviderVerificationStatus {
  UNVERIFIED = "UNVERIFIED",
  UNDER_REVIEW = "UNDER_REVIEW",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  SUSPENDED = "SUSPENDED",
}

export enum ServiceRequestStatus {
  REQUESTED = "REQUESTED",
  ASSIGNED = "ASSIGNED",
  ON_THE_WAY = "ON_THE_WAY",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
}

export enum TechnicianResponseStatus {
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
}

export enum UrgencyLevel {
  baja = "baja",
  media = "media",
  alta = "alta",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
}

export enum PaymentMethodType {
  NEQUI = "NEQUI",
  DAVIPLATA = "DAVIPLATA",
  BREB = "BREB",
  BANK_TRANSFER = "BANK_TRANSFER",
  CREDIT_CARD = "CREDIT_CARD",
  DEBIT_CARD = "DEBIT_CARD",
  CASH = "CASH",
}

export enum NotificationType {
  REQUEST_CREATED = "REQUEST_CREATED",
  REQUEST_ASSIGNED = "REQUEST_ASSIGNED",
  PROVIDER_ON_THE_WAY = "PROVIDER_ON_THE_WAY",
  SERVICE_STARTED = "SERVICE_STARTED",
  SERVICE_COMPLETED = "SERVICE_COMPLETED",
  PAYMENT_RECEIVED = "PAYMENT_RECEIVED",
  RATING_RECEIVED = "RATING_RECEIVED",
  ACCOUNT_VERIFIED = "ACCOUNT_VERIFIED",
  DOCUMENT_REJECTED = "DOCUMENT_REJECTED",
  SYSTEM = "SYSTEM",
}

export enum RoleName {
  USER = "USER",
  PROVIDER = "PROVIDER",
  ADMIN = "ADMIN",
  MODERATOR = "MODERATOR",
}

export enum AuthProvider {
  EMAIL = "EMAIL",
  GOOGLE = "GOOGLE",
  FACEBOOK = "FACEBOOK",
  PHONE_OTP = "PHONE_OTP",
}

export enum CancellationReason {
  USER_CANCELLED = "USER_CANCELLED",
  PROVIDER_CANCELLED = "PROVIDER_CANCELLED",
  NO_PROVIDER_AVAILABLE = "NO_PROVIDER_AVAILABLE",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  ADMIN_CANCELLED = "ADMIN_CANCELLED",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  PENDING = "PENDING",
}
