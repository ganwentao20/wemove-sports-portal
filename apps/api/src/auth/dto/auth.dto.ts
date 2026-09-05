import { IsBoolean, IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** 密码强度规则（注册/重置共用；72 为 bcrypt 输入上限） */
export const PASSWORD_RULES = {
  min: 8,
  max: 72,
  pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
  patternMessage: 'password must contain letters and numbers',
} as const;

/** B2C/经销商成员注册（合规：必须成年人声明 ageConfirmed=true） */
export class RegisterDto {
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

  @IsBoolean({ message: 'adults only: age confirmation is required' })
  ageConfirmed!: boolean;
}

export class LoginDto {
  @IsEmail({}, { message: 'email format invalid' })
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class StaffLoginDto {
  @IsEmail({}, { message: 'email format invalid' })
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;
}

export class ResendVerificationDto {
  @IsEmail({}, { message: 'email format invalid' })
  @MaxLength(254)
  email!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'email format invalid' })
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(PASSWORD_RULES.min, { message: 'password must be at least 8 characters' })
  @MaxLength(PASSWORD_RULES.max)
  @Matches(PASSWORD_RULES.pattern, { message: PASSWORD_RULES.patternMessage })
  password!: string;
}
