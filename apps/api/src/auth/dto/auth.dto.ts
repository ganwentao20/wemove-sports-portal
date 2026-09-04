import { IsBoolean, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must contain letters and numbers',
  })
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
