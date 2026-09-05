import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PASSWORD_RULES } from '../../auth/dto/auth.dto.js';

// ---------------------------------------------------------------------------
// Staff 管理（Admin）
// ---------------------------------------------------------------------------

export class CreateStaffDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsEmail({}, { message: 'email format invalid' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_RULES.min, { message: 'password must be at least 8 characters' })
  @MaxLength(PASSWORD_RULES.max)
  @Matches(PASSWORD_RULES.pattern, { message: PASSWORD_RULES.patternMessage })
  password!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  /** 全量替换角色（传空数组=无角色） */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];
}

export class SetStaffPasswordDto {
  @IsString()
  @MinLength(PASSWORD_RULES.min, { message: 'password must be at least 8 characters' })
  @MaxLength(PASSWORD_RULES.max)
  @Matches(PASSWORD_RULES.pattern, { message: PASSWORD_RULES.patternMessage })
  password!: string;
}

export class ChangeMyPasswordDto {
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @IsString()
  @MinLength(PASSWORD_RULES.min, { message: 'password must be at least 8 characters' })
  @MaxLength(PASSWORD_RULES.max)
  @Matches(PASSWORD_RULES.pattern, { message: PASSWORD_RULES.patternMessage })
  newPassword!: string;
}

export class StaffQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}

// ---------------------------------------------------------------------------
// 角色 / 权限
// ---------------------------------------------------------------------------

export class RoleCreateDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,31}$/, {
    message: 'role code must be uppercase letters/digits/underscore, e.g. SUPER_ADMIN',
  })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}

export class RolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}

export class RoleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 100;
}

// ---------------------------------------------------------------------------
// 审计日志查询
// ---------------------------------------------------------------------------

export class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 20;

  @IsOptional()
  @IsIn(['ANON', 'CUSTOMER', 'STAFF'])
  actorKind?: 'ANON' | 'CUSTOMER' | 'STAFF';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;
}
