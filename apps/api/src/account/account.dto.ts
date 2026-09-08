import { LANGUAGE_CODE } from '../platform/locale-policy.js';
import { PageQueryDto } from '../common/pagination.dto.js';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_RULES } from '../auth/dto/auth.dto.js';
export class ProfileDto {
  @IsOptional() @IsString() @MaxLength(60) displayName?: string;
  @IsOptional() @IsString() @Matches(/^(?:[A-Z]{2})?$/) country?: string;
  @IsOptional() @IsBoolean() productUpdates?: boolean;

  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @Matches(LANGUAGE_CODE) locale!: string;
  @IsBoolean() marketingEmail!: boolean;
  @IsBoolean() marketingSms!: boolean;
}
export class AddressDto {
  @IsString() @MinLength(1) @MaxLength(60) label!: string;
  @IsString() @MinLength(1) @MaxLength(100) recipient!: string;
  @IsString() @MinLength(3) @MaxLength(40) phone!: string;
  @IsString() @Matches(/^[A-Z]{2}$/) country!: string;
  @IsString() @MaxLength(100) region!: string;
  @IsString() @MinLength(1) @MaxLength(100) city!: string;
  @IsString() @MinLength(1) @MaxLength(30) postalCode!: string;
  @IsString() @MinLength(1) @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsBoolean() isDefaultBilling!: boolean;
  @IsBoolean() isDefaultShipping!: boolean;
}
export class AccountPasswordDto {
  @IsString() @MinLength(1) oldPassword!: string;
  @IsString()
  @MinLength(PASSWORD_RULES.min)
  @MaxLength(PASSWORD_RULES.max)
  @Matches(PASSWORD_RULES.pattern)
  newPassword!: string;
}
export class PrivacyRequestDto {
  @IsString() @MinLength(1) password!: string;
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}
export class ResolvePrivacyDto {
  @IsIn(['COMPLETED', 'REJECTED']) status!: 'COMPLETED' | 'REJECTED';
  @IsString() @MinLength(10) @MaxLength(2000) resolution!: string;
}
export class UserStatusDto {
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
  @IsIn(['ACTIVE', 'SUSPENDED']) status!: 'ACTIVE' | 'SUSPENDED';
}
export class AccountMfaSetupDto {
  @IsString() @MinLength(1) password!: string;
}
export class AccountMfaCodeDto {
  @IsString() @Length(6, 6) @Matches(/^\d{6}$/) code!: string;
}

export class ResetAccountMfaDto {
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
}

export class AccountAdminQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(['ACTIVE', 'PENDING', 'SUSPENDED']) status?:
    'ACTIVE' | 'PENDING' | 'SUSPENDED';
}
