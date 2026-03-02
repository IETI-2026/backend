import { SetMetadata } from "@nestjs/common";
import { RoleName } from "@/database/enums";

export const ROLES_KEY = "roles";
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
